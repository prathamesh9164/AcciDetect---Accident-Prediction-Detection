# AcciDetect - Interview Preparation Guide

This document breaks down the languages, frameworks, and technicalities of the AcciDetect project, structured specifically for technical interview preparation.

## 1. Project Overview
AcciDetect is an AI-powered road accident detection and prediction system. It processes pre-recorded traffic videos or real-time webcam feeds using YOLO object detection, tracks vehicles, estimates speeds, and predicts collision probabilities using a physics-based sigmoid model.

## 2. Tech Stack & Technologies Used

### Frontend
* **React (v19.2.0)**: Used as the core UI framework for building a responsive Single Page Application (SPA).
* **Tailwind CSS**: Utility-first CSS framework used for rapid, modern, and responsive styling (including dark mode).
* **Recharts**: Composable charting library built on React components. Used to visualize speed history, probability timelines, and accident distributions (SpeedChart, ProbabilityChart, AccidentDistributionChart).
* **Lucide React**: Used for modern, clean iconography across the dashboard.
* **HTML5 `<video>` / `<canvas>`**: Used for playing the uploaded video, processed video output, and rendering the live stream detection.

### Backend
* **Python (3.10+)**: Core programming language for backend logic and ML pipeline.
* **Django (4.2.7)**: High-level Python web framework used for database modeling (ORM) and project structure.
* **Django REST Framework (DRF)**: Used to build the REST API endpoints (handling video uploads, status polling, and data retrieval).
* **Django Channels & Daphne**: ASGI (Asynchronous Server Gateway Interface) server and Channels used to handle WebSocket connections for real-time live video stream processing.
* **Celery**: Asynchronous task queue/job queue. Used to offload the heavy video processing (YOLO inference) to the background so the HTTP request doesn't block or timeout.
* **Redis**: In-memory data structure store used as a message broker for Celery and potentially for Django Channels.
* **SQLite (Default)**: Used as the relational database to store VideoAnalysis metadata, Vehicle data, and AccidentEvent records.

### Machine Learning & Computer Vision
* **YOLOv8 / YOLOv5 (Ultralytics)**: State-of-the-art object detection models used to detect vehicles (cars, trucks, buses, motorcycles) in each frame.
* **PyTorch**: Deep learning tensor library used as the underlying framework for running YOLO model inferences.
* **OpenCV (cv2)**: Core computer vision library used for reading video streams, manipulating frames (resizing, drawing bounding boxes, text), and writing the output video (`cv2.VideoWriter`).
* **Numpy / Pandas**: Used for numerical operations, array manipulations (handling OpenCV frames and PyTorch tensors), and generating CSV reports of the vehicle data.

---

## 3. Core Technicalities & Algorithms

### Vehicle Tracking Algorithm
* **Centroid Tracking**: Calculates the center (centroid) of the bounding box for each detected vehicle.
* **Frame-to-Frame Matching**: Compares centroids in the current frame to the previous frame using the Euclidean distance (`math.hypot`). If the distance is below `DISTANCE_MATCH_THRESHOLD` (100 pixels), it assumes it's the same vehicle.
* **Handling Missing Frames**: If a vehicle isn't detected in a frame, a `missing` counter increments. If it exceeds `MAX_MISSING_FRAMES` (30 frames), the vehicle is removed from tracking.

### Speed Estimation
* **Pixel to Meter Conversion**: Uses a constant `METERS_PER_PIXEL = 0.05` to convert pixel movement to real-world distance.
* **Calculation**: Calculates distance moved between frames, divides by the time delta (`dt = frames / fps`), yielding meters per second (m/s). This is then multiplied by `3.6` to get km/h. Uses a rolling average over the last few frames to smooth out speed spikes.

### Collision Probability Model (Physics-based Sigmoid)
* **Relative Speed**: Calculates the absolute difference between the speeds of two vehicles.
* **Distance**: Calculates Euclidean distance between their centroids.
* **Formula**: `P(v1, v2) = sigmoid( k * |v1 - v2| / (d + 0.5) - 1.5 )`
  * As distance (`d`) decreases and relative speed (`|v1 - v2|`) increases, the raw value goes up.
  * The sigmoid function squashes this value between 0 and 1.
* **Thresholds**: `< 0.4` (Safe/Green), `0.4 - 0.8` (Likely/Blue), `> 0.8` (Accident/Red).

### Video Processing Pipeline (Background)
* When a user uploads a video, a Django view triggers a Celery task `process_video_background`.
* The server uses OpenCV to read frames, runs YOLO inference, tracks vehicles, calculates speed/probability, draws annotations, and writes frames to a temporary output file.
* Once done, FFmpeg is used to compress the final video (H.264 codec, CRF 28) before saving it to Django's `MEDIA_ROOT`.
* A 8-second clip (3s pre, 5s post) is extracted if an accident occurs.

### Live Stream Pipeline (WebSockets)
* The React frontend captures webcam frames via `navigator.mediaDevices.getUserMedia` and draws them to a `<canvas>`.
* The frontend converts frames to Base64 strings and sends them to the backend via WebSocket.
* `LiveStreamConsumer` (Django Channels) receives the Base64 frame, decodes it to a Numpy array, runs YOLO, tracks vehicles, and immediately sends the bounding box data and probabilities back to the frontend.

---

## 4. Potential Interview Questions & Answers

### System Architecture & Design
**Q: Why did you choose Django over FastAPI or Flask, especially since this is an ML-heavy application?**
**A:** Django provides a robust ORM out of the box, which was useful for managing the relational data between `VideoAnalysis`, `Vehicle`, and `AccidentEvent` models. While FastAPI is faster for async ML inferences, Django's ecosystem, combined with Django REST Framework for APIs and Django Channels for WebSockets, provided a structured, all-in-one solution for both the REST endpoints and the real-time live streaming needs.

**Q: How do you handle long-running video processing requests without blocking the web server?**
**A:** I decoupled the heavy ML processing from the HTTP request-response cycle using Celery and Redis. When a video is uploaded, the API creates a database record with a "pending" status and triggers a Celery background task. The API immediately returns the task ID to the frontend. The React frontend then periodically polls a status endpoint to get progress updates (0-100%).

### Machine Learning & Computer Vision
**Q: How does the vehicle tracking work? Why did you implement centroid tracking instead of using an existing tracker like DeepSORT?**
**A:** I implemented a custom Euclidean distance-based centroid tracker. It calculates the center of YOLO bounding boxes and matches them across frames if the distance is below a threshold. I chose this approach for its simplicity and fast execution time, which is crucial for the real-time live stream feature. While DeepSORT (which uses visual features and Kalman filtering) is more accurate, especially with occlusions, the centroid tracker was computationally lighter and sufficient for this specific collision probability model.

**Q: Explain how you calculate the speed of a vehicle in a 2D video.**
**A:** Speed estimation in 2D video without camera calibration (intrinsics/extrinsics) is an approximation. I defined a constant `METERS_PER_PIXEL` (e.g., 0.05). I calculate the pixel distance moved by a vehicle's centroid between frames, multiply it by `METERS_PER_PIXEL` to get real-world distance, and divide by the time elapsed (calculated using the video's FPS) to get meters per second. Finally, I multiply by 3.6 to convert to km/h.

**Q: How did you formulate the Collision Probability Model?**
**A:** It's a physics-inspired heuristic model. The probability of collision is directly proportional to the relative speed between two vehicles and inversely proportional to the distance between them. I used a Sigmoid function `1 / (1 + e^(-x))` to map this raw relationship into a normalized probability between 0 and 1. The formula incorporates a sensitivity constant `k` and a `- 1.5` offset to shift the sigmoid curve so that normal traffic doesn't constantly trigger false positives.

### Backend & Real-Time (WebSockets)
**Q: Explain how the real-time webcam detection works.**
**A:** The frontend uses the browser's MediaDevices API to capture webcam frames. It converts these frames to Base64 and sends them over a WebSocket connection to the backend. The backend uses Django Channels (`AsyncWebsocketConsumer`) to receive the frame, decodes it into an OpenCV Numpy array, runs the YOLO detection and tracking algorithms, and sends back a JSON payload containing the bounding boxes, speeds, and colors. The frontend then overlays this data.

**Q: Why did you use FFmpeg for the final video output instead of just saving the OpenCV `VideoWriter` output?**
**A:** OpenCV's `VideoWriter` is great for assembling frames, but its output files are often very large and sometimes lack the "moov atom" at the beginning of the file (required for progressive streaming in web browsers). I use the `subprocess` module to run FFmpeg on the OpenCV output to compress it using the H.264 codec (`libx264`) with a CRF of 28, and apply the `+faststart` flag to ensure the video plays smoothly on the web frontend.

### Frontend (React)
**Q: How did you handle the state and data visualization in React?**
**A:** State management is handled using React Hooks (`useState`, `useEffect`, `useRef`). For data visualization, I used Recharts to plot speed history and collision probabilities over time. When a user clicks on a specific `VehicleCard`, the state updates `selectedVehicle`, which dynamically renders the specific charts for that vehicle.

**Q: How did you implement Dark Mode?**
**A:** I implemented Dark Mode using Tailwind CSS's `dark:` variant and React state. The state reads the initial preference from `localStorage` or the system `matchMedia` preference. Toggling the state adds or removes the `dark` class on the root `<html>` element, allowing Tailwind to apply the dark mode utility classes seamlessly.

### Performance & Optimization
**Q: What are the bottlenecks in this application, and how would you scale it?**
**A:** The primary bottleneck is the YOLO inference, which is highly CPU/GPU bound. 
To scale:
1.  **Hardware**: Run the Celery workers on machines with dedicated GPUs (NVIDIA/CUDA).
2.  **Model Optimization**: Export the YOLO PyTorch model to TensorRT or ONNX for faster inference.
3.  **Microservices**: Separate the ML processing pipeline into a dedicated microservice (e.g., a FastAPI app) rather than keeping it tightly coupled with the Django web server.
4.  **Tracking**: Upgrade the simple centroid tracker to a more robust tracker like ByteTrack, which is fast and handles occlusions better.
