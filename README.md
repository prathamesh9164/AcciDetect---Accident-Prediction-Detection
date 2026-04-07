# 🚨 AcciDetect — Accident Detection & Prediction System

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Django-4.2-092e20?style=for-the-badge&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/YOLOv8-ultralytics-ff6b35?style=for-the-badge" />
  <img src="https://img.shields.io/badge/WebSocket-Django%20Channels-brightgreen?style=for-the-badge" />
</p>

> **AcciDetect** is an AI-powered road accident detection and prediction system. It uses **YOLOv5/YOLOv8** object detection and a **physics-based collision probability model** to analyze pre-recorded traffic videos or real-time webcam/CCTV feeds — tracking vehicles, estimating speeds, and predicting collisions before they happen.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📹 **Video Upload & Analysis** | Upload traffic footage and get a fully annotated output video with per-vehicle overlays |
| 🔴 **Live Stream Detection** | Real-time accident detection via WebSocket — stream frames from webcam or CCTV |
| 🚗 **Vehicle Tracking** | Multi-vehicle tracking with unique IDs, speed history, and trajectory tracing |
| 💥 **Collision Probability** | Physics-based sigmoid model computing real-time collision risk between vehicle pairs |
| 📊 **Analytics Dashboard** | Speed charts, probability timelines, and per-vehicle statistics via Recharts |
| 📦 **Export Options** | Download annotated video, accident clip, and full vehicle data as CSV |
| 🔔 **Accident Alerting** | Highlighted bounding boxes and alerts when collision probability exceeds threshold |

---

## 🏗️ Architecture

```
AcciDetect/
├── backend/                    # Django + Django REST Framework
│   ├── accident_detection/     # Django project settings, ASGI, Celery config
│   ├── detection/              # Core app
│   │   ├── models.py           # VideoAnalysis, Vehicle, AccidentEvent models
│   │   ├── views.py            # REST API ViewSets (upload, status, download)
│   │   ├── consumers.py        # WebSocket consumer (live stream processing)
│   │   ├── video_processor.py  # YOLOv8 inference + tracking + collision logic
│   │   ├── tasks.py            # Celery async task for background video processing
│   │   ├── serializers.py      # DRF serializers
│   │   └── urls.py             # API routing
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/                   # React 19 SPA
    ├── src/
    │   ├── App.js              # Main app with all views (upload, live, results)
    │   ├── App.css             # Styling
    │   └── index.js
    ├── package.json
    └── tailwind.config.js
```

### Data Flow

```
[User uploads video / streams webcam]
          │
          ▼
   Django REST API / WebSocket
          │
          ▼
  YOLOv5 / YOLOv8 Detection
  (vehicle bounding boxes)
          │
          ▼
  Multi-Vehicle Tracker
  (centroid-based, frame-to-frame matching)
          │
          ▼
  Speed Estimator (pixel → km/h)
  + Collision Probability Model
  (sigmoid: P = 1/(1+e^(-k·v_rel/d + 1.5)))
          │
          ▼
  Annotated Video + JSON results
  → React Dashboard (charts, clips, CSV)
```

---

## 🛠️ Tech Stack

### Backend
| Library | Version | Purpose |
|---|---|---|
| Django | 4.2.7 | Web framework |
| Django REST Framework | 3.14.0 | REST API |
| Django Channels | 4.0.0 | WebSocket support |
| Daphne | 4.0.0 | ASGI server |
| Ultralytics (YOLOv8) | 8.0.196 | Object detection |
| PyTorch | 2.1.1 | Deep learning runtime |
| OpenCV | 4.8.1 | Video read/write/processing |
| Celery | 5.3.4 | Async background tasks |
| Redis | 5.0.1 | Celery broker + result backend |
| pandas / numpy | latest | Data processing & CSV export |
| django-cors-headers | 4.3.1 | CORS configuration |

### Frontend
| Library | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| Recharts | 3.3.0 | Speed & probability charts |
| Lucide React | 0.552.0 | Icons |
| Tailwind CSS | 3.4.17 | Utility-first styling |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Redis (for Celery async processing)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/prathamesh9164/AcciDetect---Accident-Prediction-Detection.git
cd AcciDetect---Accident-Prediction-Detection
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Download YOLOv8 Model Weights

The model weights are not included in the repository. Download them manually:

```bash
# Option 1: Using wget (Linux/macOS)
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt -P backend/

# Option 2: Using Python
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Option 3: Manual download
# Go to: https://github.com/ultralytics/ultralytics/releases
# Download yolov8n.pt and place it in the backend/ directory
```

#### Apply Migrations & Create Superuser

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser   # optional – for Django admin access
```

#### Create Required Directories

```bash
mkdir -p media/videos media/output media/clips media/csv logs
```

#### Start the Backend Server

```bash
# Development (Daphne ASGI – supports WebSockets)
daphne -p 8000 accident_detection.asgi:application

# Or: standard Django dev server (no WebSocket support)
python manage.py runserver
```

> ⚠️ For live-stream WebSocket features, you **must** use Daphne or another ASGI server.

#### (Optional) Start Celery Worker

For background video processing with Celery:

```bash
# Make sure Redis is running first
celery -A accident_detection worker --loglevel=info
```

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The React app will run at **http://localhost:3000** and proxy API calls to **http://localhost:8000**.

---

## 📡 API Reference

Base URL: `http://localhost:8000/api/`

### Video Analysis

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyses/` | Upload a video and start analysis |
| `GET` | `/api/analyses/` | List all analyses |
| `GET` | `/api/analyses/{id}/` | Get analysis details |
| `GET` | `/api/analyses/{id}/status/` | Get processing status & progress |
| `GET` | `/api/analyses/{id}/vehicles/` | Get all tracked vehicles |
| `GET` | `/api/analyses/{id}/graph_data/` | Get chart-ready graph data |
| `GET` | `/api/analyses/{id}/download_video/` | Download annotated output video |
| `GET` | `/api/analyses/{id}/download_clip/` | Download accident clip |
| `GET` | `/api/analyses/{id}/download_csv/` | Download vehicle data as CSV |
| `DELETE` | `/api/analyses/{id}/delete_analysis/` | Delete analysis and all files |

### WebSocket — Live Detection

```
ws://localhost:8000/ws/live/
```

**Send (client → server):**
```json
{ "type": "frame", "frame": "<base64-encoded-jpeg>" }
{ "type": "config", "fps": 25.0 }
```

**Receive (server → client):**
```json
{
  "type": "detection",
  "frame": 142,
  "vehicles": [
    { "id": 1, "bbox": [x1, y1, x2, y2], "speed": 52.3, "probability": 0.12, "color": "green" },
    { "id": 2, "bbox": [x1, y1, x2, y2], "speed": 88.7, "probability": 0.91, "color": "red" }
  ],
  "accident_detected": true,
  "total_vehicles": 2
}
```

---

## 🧠 Collision Probability Model

The system computes a **pairwise collision probability** for every pair of tracked vehicles using the formula:

```
P(v1, v2) = sigmoid( k × |v1 - v2| / (d + 0.5) - 1.5 )
```

Where:
- `v1`, `v2` = speeds of the two vehicles in m/s
- `d` = distance between their centroids in metres
- `k = 1.0` = sensitivity constant

| Probability | Color | Status |
|---|---|---|
| ≥ 0.80 | 🔴 Red | Accident |
| ≥ 0.40 | 🔵 Blue | Likely collision |
| < 0.40 | 🟢 Green | Safe |

---

## 🗄️ Database Models

### `VideoAnalysis`
Stores metadata for each uploaded or live analysis session: status, progress, FPS, dimensions, accident detection flag, and paths to generated output files.

### `Vehicle`
Tracks each unique vehicle detected during an analysis: speed history, probability history, centroid trajectory, bounding box, and accident flag.

### `AccidentEvent`
Records a detected accident event with the frame number, timestamp, involved vehicles (M2M), collision point, and surrounding frame context.

---

## 🔧 Configuration

Key settings are in `backend/accident_detection/settings.py`:

| Setting | Default | Description |
|---|---|---|
| `DEBUG` | `True` | Set to `False` in production |
| `ALLOWED_HOSTS` | `['*']` | Restrict in production |
| `MEDIA_ROOT` | `backend/media/` | Where uploaded/output files are stored |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | 500 MB | Max video upload size |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis URL for Celery |
| `CHANNEL_LAYERS` | In-Memory | Use Redis channels layer in production |

---

## 📁 Key Files

| File | Description |
|---|---|
| `backend/detection/video_processor.py` | Core YOLOv8 inference pipeline, vehicle tracker, speed estimator, accident detection logic |
| `backend/detection/consumers.py` | Async WebSocket consumer — live frame-by-frame processing |
| `backend/detection/tasks.py` | Celery task that runs `video_processor` in the background |
| `frontend/src/App.js` | Entire React frontend — upload UI, live-stream view, results dashboard, and charts |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is for educational and research purposes. Feel free to use, modify, and distribute.

---

## 👨‍💻 Author

**Prathamesh Talele** — [@prathamesh9164](https://github.com/prathamesh9164)

---

<p align="center">Made with ❤️ using YOLOv8, Django Channels, and React</p>
