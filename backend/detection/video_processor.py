
import cv2
import numpy as np
import pandas as pd
from collections import deque
import math
import os
from django.core.files import File
from django.core.files.base import ContentFile
from django.utils import timezone
from .models import VideoAnalysis, Vehicle, AccidentEvent
import tempfile
import logging

from ultralytics import YOLO

logger = logging.getLogger(__name__)

METERS_PER_PIXEL = 0.05
MAX_MISSING_FRAMES = 30
DISTANCE_MATCH_THRESHOLD = 100
PROB_K = 1.0
PROB_ACCIDENT_THRESHOLD = 0.8
PROB_LIKELY_THRESHOLD = 0.4
PRE_ACCIDENT_SECONDS = 3
POST_ACCIDENT_SECONDS = 5
VEHICLE_CLASSES = {"car", "truck", "bus", "motorbike", "motorcycle"}


class TrackedVehicle:
    """Class to track individual vehicles across frames"""
    def __init__(self, id_, bbox, frame_idx):
        self.id = id_
        self.bbox = bbox
        self.centroids = deque(maxlen=50)
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.centroids.append((cx, cy, frame_idx))
        self.last_frame = frame_idx
        self.first_frame = frame_idx
        self.missing = 0
        self.speeds = deque(maxlen=30)
        self.avg_speed_kmh = 0.0
        self.max_speed_kmh = 0.0
        self.latest_prob = 0.0
        self.max_prob = 0.0
        self.speed_history = []
        self.prob_history = []
        self.is_accident = False
        self.accident_frame = None

    def update(self, bbox, frame_idx):
        """Update tracker with new detection"""
        self.bbox = bbox
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.centroids.append((cx, cy, frame_idx))
        self.last_frame = frame_idx
        self.missing = 0

    def mark_missing(self):
        """Mark frame as missed"""
        self.missing += 1

    def compute_speed(self, meters_per_pixel, fps):
        """Calculate speed based on movement between frames"""
        if len(self.centroids) >= 2:
            (x1, y1, f1), (x2, y2, f2) = self.centroids[-2], self.centroids[-1]
            pixel_dist = math.hypot(x2 - x1, y2 - y1)
            dt_frames = f2 - f1
            if dt_frames <= 0:
                return None
            dt = dt_frames / fps
            meters = pixel_dist * meters_per_pixel
            mps = meters / dt
            kmh = mps * 3.6
            self.speeds.append(kmh)
            if len(self.speeds) > 0:
                self.avg_speed_kmh = float(sum(self.speeds) / len(self.speeds))
            else:
                self.avg_speed_kmh = kmh
            self.max_speed_kmh = max(self.max_speed_kmh, kmh)
            return kmh
        return None


def collision_probability(v1_speed_kmh, v2_speed_kmh, dist_m):
    """Calculate collision probability based on speed and distance"""
    v1 = v1_speed_kmh / 3.6 if v1_speed_kmh is not None else 0.0
    v2 = v2_speed_kmh / 3.6 if v2_speed_kmh is not None else 0.0
    rel_speed = abs(v1 - v2)
    prob_raw = PROB_K * rel_speed / (dist_m + 0.5)
    prob = 1.0 / (1.0 + math.exp(-prob_raw + 1.5))
    return max(0.0, min(1.0, prob))


class VideoProcessor:
    """Main video processing class"""
    def __init__(self, analysis_id, model_path="yolov8n.pt", device=None):
        self.analysis = VideoAnalysis.objects.get(id=analysis_id)
        self.model = None
        self.model_path = model_path
        self.device = device  
        self.trackers = {}
        self.next_id = 1
        self.accident_happened = False
        self.accident_frame = None

    def load_model(self):
        """Load YOLOv8 model (ultralytics)"""
        logger.info("Loading YOLOv8 model...")
        try:
            if self.device:
                self.model = YOLO(self.model_path).to(self.device)
            else:
                self.model = YOLO(self.model_path)
            logger.info("YOLOv8 model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading YOLOv8 model: {str(e)}")
            raise

    def update_progress(self, progress, status='processing'):
        """Update analysis progress in database"""
        self.analysis.progress = min(progress, 100)
        self.analysis.status = status
        self.analysis.save(update_fields=['progress', 'status'])
        logger.info(f"Progress: {progress}% - Status: {status}")

    def process_video(self):
        """Main video processing function"""
        try:
            self.update_progress(5, 'processing')

            self.load_model()
            self.update_progress(10)

            video_path = self.analysis.video_file.path
            cap = cv2.VideoCapture(video_path)

            if not cap.isOpened():
                raise Exception("Could not open video file")

            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

            logger.info(f"Video properties: {width}x{height}, {fps} fps, {total_frames} frames")

            self.analysis.fps = fps
            self.analysis.width = width
            self.analysis.height = height
            self.analysis.total_frames = total_frames
            self.analysis.duration_seconds = total_frames / fps if fps > 0 else 0
            self.analysis.save()

            output_path = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4').name
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

            pre_buffer = deque(maxlen=int(PRE_ACCIDENT_SECONDS * fps))
            accident_writer = None
            post_frames_remaining = 0
            accident_clip_path = None

            frame_idx = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                orig = frame.copy()

                if total_frames > 0 and frame_idx % 10 == 0:
                    progress = 10 + int((frame_idx / total_frames) * 80)
                    self.update_progress(progress)

                detections = self._detect_vehicles(frame)

                self._update_trackers(detections, frame_idx)

                for tid, tr in self.trackers.items():
                    speed = tr.compute_speed(METERS_PER_PIXEL, fps)
                    if speed is not None:
                        tr.speed_history.append({
                            'frame': frame_idx,
                            'speed': round(speed, 2)
                        })

                vehicle_probs = self._compute_probabilities()

                for tid, prob in vehicle_probs.items():
                    tr = self.trackers[tid]
                    tr.latest_prob = prob
                    tr.max_prob = max(tr.max_prob, prob)
                    tr.prob_history.append({
                        'frame': frame_idx,
                        'probability': round(prob, 3)
                    })

                accident_now = any(p >= PROB_ACCIDENT_THRESHOLD for p in vehicle_probs.values())

                annotated = self._annotate_frame(orig, frame_idx, total_frames, fps, vehicle_probs)

                out.write(annotated)
                pre_buffer.append(annotated.copy())

                if accident_now and not self.accident_happened:
                    logger.warning(f"Accident detected at frame {frame_idx}")
                    self.accident_happened = True
                    self.accident_frame = frame_idx

                    for tid, prob in vehicle_probs.items():
                        if prob >= PROB_ACCIDENT_THRESHOLD:
                            self.trackers[tid].is_accident = True
                            self.trackers[tid].accident_frame = frame_idx

                    accident_clip_path = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4').name
                    accident_writer = cv2.VideoWriter(accident_clip_path, fourcc, fps, (width, height))

                    for f in list(pre_buffer):
                        accident_writer.write(f)

                    post_frames_remaining = int(POST_ACCIDENT_SECONDS * fps)

                if accident_writer is not None:
                    accident_writer.write(annotated)
                    if post_frames_remaining > 0:
                        post_frames_remaining -= 1
                    elif self.accident_happened and post_frames_remaining <= 0:
                        accident_writer.release()
                        accident_writer = None
                        logger.info("Accident clip saved")

            cap.release()
            out.release()
            if accident_writer is not None:
                accident_writer.release()

            self._save_results(output_path, accident_clip_path)

            self.analysis.status = 'completed'
            self.analysis.progress = 100
            self.analysis.completed_at = timezone.now()
            self.analysis.save()

            self.update_progress(100, 'completed')
            logger.info(f"Video processing completed for analysis {self.analysis.id}")

        except Exception as e:
            logger.error(f"Error processing video: {str(e)}", exc_info=True)
            self.analysis.status = 'failed'
            self.analysis.error_message = str(e)
            self.analysis.save()
            raise

    def _detect_vehicles(self, frame):
        """Detect vehicles in frame using YOLOv8"""
        img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = self.model(img, conf=0.35, iou=0.45)

        vehicle_dets = []

        for res in results:
            boxes = res.boxes  
            if boxes is None or len(boxes) == 0:
                continue

            xyxy_arr = boxes.xyxy.cpu().numpy() 
            conf_arr = boxes.conf.cpu().numpy().reshape(-1) 
            cls_arr = boxes.cls.cpu().numpy().astype(int).reshape(-1)  

            for (x1, y1, x2, y2), conf, cls in zip(xyxy_arr, conf_arr, cls_arr):
                cls_name = self.model.names.get(int(cls), str(cls))
                normalized_name = cls_name.lower()
                if normalized_name == "motorcycle":
                    normalized_name = "motorcycle"
                if normalized_name in VEHICLE_CLASSES:
                    bbox = (int(x1), int(y1), int(x2), int(y2))
                    vehicle_dets.append((bbox, float(conf), normalized_name))

        return vehicle_dets

    def _update_trackers(self, detections, frame_idx):
        """Update vehicle trackers with new detections"""
        det_centroids = []
        for bbox, conf, cls in detections:
            cx = int((bbox[0] + bbox[2]) / 2)
            cy = int((bbox[1] + bbox[3]) / 2)
            det_centroids.append((cx, cy))

        assigned_det_idx = set()

        for tid, tr in list(self.trackers.items()):
            if len(tr.centroids) == 0:
                continue
            last_cx, last_cy, _ = tr.centroids[-1]
            best_i = None
            best_dist = float('inf')

            for i, (cx, cy) in enumerate(det_centroids):
                if i in assigned_det_idx:
                    continue
                d = math.hypot(cx - last_cx, cy - last_cy)
                if d < best_dist:
                    best_dist = d
                    best_i = i

            if best_i is not None and best_dist < DISTANCE_MATCH_THRESHOLD:
                bbox, conf, cls = detections[best_i]
                tr.update(bbox, frame_idx)
                assigned_det_idx.add(best_i)

        for i, (bbox, conf, cls) in enumerate(detections):
            if i not in assigned_det_idx:
                tr = TrackedVehicle(self.next_id, bbox, frame_idx)
                self.trackers[self.next_id] = tr
                self.next_id += 1

        to_delete = []
        for tid, tr in list(self.trackers.items()):
            if tr.last_frame != frame_idx:
                tr.mark_missing()
            if tr.missing > MAX_MISSING_FRAMES:
                to_delete.append(tid)

        for tid in to_delete:
            del self.trackers[tid]

    def _compute_probabilities(self):
        """Compute collision probabilities"""
        id_centroid_m = {}
        id_speed = {}

        for tid, tr in self.trackers.items():
            if len(tr.centroids) == 0:
                continue
            cx, cy, fidx = tr.centroids[-1]
            id_centroid_m[tid] = (cx * METERS_PER_PIXEL, cy * METERS_PER_PIXEL)
            id_speed[tid] = tr.speeds[-1] if len(tr.speeds) > 0 else 0.0

        vehicle_probs = {tid: 0.0 for tid in self.trackers.keys()}

        for tid1 in self.trackers.keys():
            for tid2 in self.trackers.keys():
                if tid1 >= tid2:
                    continue

                c1 = id_centroid_m.get(tid1)
                c2 = id_centroid_m.get(tid2)

                if c1 is None or c2 is None:
                    continue

                dist_m = math.hypot(c1[0] - c2[0], c1[1] - c2[1])
                p = collision_probability(id_speed.get(tid1, 0.0), id_speed.get(tid2, 0.0), dist_m)

                vehicle_probs[tid1] = max(vehicle_probs[tid1], p)
                vehicle_probs[tid2] = max(vehicle_probs[tid2], p)

        return vehicle_probs

    def _annotate_frame(self, frame, frame_idx, total_frames, fps, vehicle_probs):
        """Annotate frame with bounding boxes and info"""
        annotated = frame.copy()

        for tid, tr in self.trackers.items():
            x1, y1, x2, y2 = tr.bbox
            prob = vehicle_probs.get(tid, 0.0)

            if prob >= PROB_ACCIDENT_THRESHOLD:
                color = (0, 0, 255)  # Red
            elif prob >= PROB_LIKELY_THRESHOLD:
                color = (255, 0, 0)  # Blue
            else:
                color = (0, 255, 0)  # Green

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            cv2.putText(annotated, f"ID {tr.id}", (x1, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            text = f"{tr.avg_speed_kmh:.1f} km/h | P:{prob:.2f}"
            cv2.putText(annotated, text, (x1, y2 + 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        cv2.putText(annotated, f"Frame: {frame_idx}/{total_frames}", (10, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        if self.accident_happened:
            cv2.putText(annotated, "ACCIDENT DETECTED!", (10, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        return annotated

    def _save_results(self, output_path, accident_clip_path):
        """Save results to database"""
        with open(output_path, 'rb') as f:
            self.analysis.output_video.save(f'output_{self.analysis.id}.mp4', File(f))

        if accident_clip_path and os.path.exists(accident_clip_path):
            with open(accident_clip_path, 'rb') as f:
                self.analysis.accident_clip.save(f'clip_{self.analysis.id}.mp4', File(f))
            self.analysis.accident_detected = True
            self.analysis.accident_frame = self.accident_frame
            if self.analysis.fps:
                self.analysis.accident_timestamp = self.accident_frame / self.analysis.fps

        csv_data = self._generate_csv()
        self.analysis.csv_file.save(
            f'vehicles_{self.analysis.id}.csv',
            ContentFile(csv_data.encode())
        )

        self._save_vehicles()

        self.analysis.save()

        try:
            os.unlink(output_path)
            if accident_clip_path:
                os.unlink(accident_clip_path)
        except Exception:
            pass

    def _generate_csv(self):
        """Generate CSV from vehicle data"""
        rows = []
        for tid, tr in self.trackers.items():
            rows.append({
                'vehicle_id': tr.id,
                'avg_speed_kmh': round(tr.avg_speed_kmh, 3),
                'max_speed_kmh': round(tr.max_speed_kmh, 3),
                'last_speed_kmh': round(tr.speeds[-1], 3) if tr.speeds else 0.0,
                'max_probability': round(tr.max_prob, 3),
                'latest_probability': round(tr.latest_prob, 3),
                'frames_tracked': len(tr.centroids),
                'first_frame': tr.first_frame,
                'last_frame': tr.last_frame,
                'is_accident_vehicle': tr.is_accident,
                'accident_frame': tr.accident_frame,
                'last_bbox': f"{tr.bbox}"
            })

        df = pd.DataFrame(rows)
        return df.to_csv(index=False)

    def _save_vehicles(self):
        """Save vehicles to database"""
        for tid, tr in self.trackers.items():
            Vehicle.objects.create(
                analysis=self.analysis,
                vehicle_id=tr.id,
                avg_speed_kmh=tr.avg_speed_kmh,
                max_speed_kmh=tr.max_speed_kmh,
                last_speed_kmh=tr.speeds[-1] if tr.speeds else 0.0,
                max_probability=tr.max_prob,
                latest_probability=tr.latest_prob,
                frames_tracked=len(tr.centroids),
                first_seen_frame=tr.first_frame,
                last_seen_frame=tr.last_frame,
                last_bbox_x1=tr.bbox[0],
                last_bbox_y1=tr.bbox[1],
                last_bbox_x2=tr.bbox[2],
                last_bbox_y2=tr.bbox[3],
                is_accident_vehicle=tr.is_accident,
                accident_frame=tr.accident_frame,
                speed_history=tr.speed_history,
                probability_history=tr.prob_history,
                centroid_history=[
                    {'frame': f, 'x': x, 'y': y}
                    for x, y, f in tr.centroids
                ]
            )
        logger.info(f"Saved {len(self.trackers)} vehicles to database")
