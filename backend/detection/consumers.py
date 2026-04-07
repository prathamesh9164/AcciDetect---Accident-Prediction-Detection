import json
import base64
import cv2
import numpy as np
import torch
from channels.generic.websocket import AsyncWebsocketConsumer
from collections import deque
import math
import logging

logger = logging.getLogger(__name__)

METERS_PER_PIXEL = 0.05
DISTANCE_MATCH_THRESHOLD = 100
PROB_K = 1.0
PROB_ACCIDENT_THRESHOLD = 0.8
PROB_LIKELY_THRESHOLD = 0.4
VEHICLE_CLASSES = {"car", "truck", "bus", "motorbike", "motorcycle"}


class TrackedVehicleLive:
    def __init__(self, id_, bbox, frame_idx):
        self.id = id_
        self.bbox = bbox
        self.centroids = deque(maxlen=30)
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.centroids.append((cx, cy, frame_idx))
        self.last_frame = frame_idx
        self.missing = 0
        self.speeds = deque(maxlen=20)
        self.avg_speed_kmh = 0.0
        self.latest_prob = 0.0

    def update(self, bbox, frame_idx):
        self.bbox = bbox
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.centroids.append((cx, cy, frame_idx))
        self.last_frame = frame_idx
        self.missing = 0

    def compute_speed(self, meters_per_pixel, fps):
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
            self.avg_speed_kmh = float(sum(self.speeds) / len(self.speeds)) if self.speeds else kmh
            return kmh
        return None


def collision_probability(v1_speed_kmh, v2_speed_kmh, dist_m):
    v1 = v1_speed_kmh / 3.6 if v1_speed_kmh is not None else 0.0
    v2 = v2_speed_kmh / 3.6 if v2_speed_kmh is not None else 0.0
    rel_speed = abs(v1 - v2)
    prob_raw = PROB_K * rel_speed / (dist_m + 0.5)
    prob = 1.0 / (1.0 + math.exp(-prob_raw + 1.5))
    return max(0.0, min(1.0, prob))


class LiveStreamConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        await self.accept()
        
        # Initialize tracking state
        self.trackers = {}
        self.next_id = 1
        self.frame_count = 0
        self.fps = 25.0
        self.model = None
        self.accident_detected = False
        
        logger.info("WebSocket connected - Live stream session started")
        
        # Load model
        await self.load_model()
        
    async def disconnect(self, close_code):
        logger.info(f"WebSocket disconnected - code: {close_code}")
        
    async def load_model(self):
        try:
            self.model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
            self.model.conf = 0.35
            self.model.iou = 0.45
            
            await self.send(text_data=json.dumps({
                'type': 'model_loaded',
                'message': 'Detection model loaded successfully'
            }))
            logger.info("Model loaded for live stream")
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Failed to load model: {str(e)}'
            }))
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            
            if data.get('type') == 'frame':
                frame_data = data.get('frame', '')
                if not frame_data:
                    return
                
                if ',' in frame_data:
                    frame_data = frame_data.split(',')[1]
                
                img_bytes = base64.b64decode(frame_data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    return
                
                self.frame_count += 1
                
                result = await self.process_frame(frame)
                
                await self.send(text_data=json.dumps(result))
                
            elif data.get('type') == 'config':
                self.fps = data.get('fps', 25.0)
                
        except Exception as e:
            logger.error(f"Error processing frame: {str(e)}", exc_info=True)
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def process_frame(self, frame):
        """Process a single frame and return detections"""
        if self.model is None:
            return {'type': 'error', 'message': 'Model not loaded'}
        
        detections = self.detect_vehicles(frame)
        
        self.update_trackers(detections, self.frame_count)
        
        for tid, tr in self.trackers.items():
            tr.compute_speed(METERS_PER_PIXEL, self.fps)
        
        vehicle_probs = self.compute_probabilities()
        
        accident_now = any(p >= PROB_ACCIDENT_THRESHOLD for p in vehicle_probs.values())
        
        if accident_now and not self.accident_detected:
            self.accident_detected = True
            logger.warning(f"ACCIDENT DETECTED in live stream at frame {self.frame_count}")
        
        vehicles_data = []
        for tid, tr in self.trackers.items():
            prob = vehicle_probs.get(tid, 0.0)
            tr.latest_prob = prob
            
            vehicles_data.append({
                'id': tr.id,
                'bbox': tr.bbox,
                'speed': round(tr.avg_speed_kmh, 1),
                'probability': round(prob, 2),
                'color': self.get_color_by_prob(prob)
            })
        
        return {
            'type': 'detection',
            'frame': self.frame_count,
            'vehicles': vehicles_data,
            'accident_detected': self.accident_detected,
            'total_vehicles': len(self.trackers)
        }
    
    def detect_vehicles(self, frame):
        """Detect vehicles in frame"""
        img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.model(img, size=640)
        detections = results.xyxy[0].cpu().numpy()
        names = results.names
        
        vehicle_dets = []
        for det in detections:
            x1, y1, x2, y2, conf, cls = det
            cls_name = names[int(cls)]
            if cls_name in VEHICLE_CLASSES:
                bbox = (int(x1), int(y1), int(x2), int(y2))
                vehicle_dets.append((bbox, float(conf), cls_name))
        
        return vehicle_dets
    
    def update_trackers(self, detections, frame_idx):
        """Update vehicle trackers"""
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
                tr = TrackedVehicleLive(self.next_id, bbox, frame_idx)
                self.trackers[self.next_id] = tr
                self.next_id += 1
        
        to_delete = []
        for tid, tr in list(self.trackers.items()):
            if tr.last_frame != frame_idx:
                tr.missing += 1
            if tr.missing > 30:
                to_delete.append(tid)
        
        for tid in to_delete:
            del self.trackers[tid]
    
    def compute_probabilities(self):
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
    
    def get_color_by_prob(self, prob):
        """Get color based on probability"""
        if prob >= PROB_ACCIDENT_THRESHOLD:
            return 'red'
        elif prob >= PROB_LIKELY_THRESHOLD:
            return 'blue'
        else:
            return 'green'