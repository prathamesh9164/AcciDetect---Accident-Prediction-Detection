# Changelog

All notable changes to **AcciDetect** are documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Planned
- GPU-accelerated inference toggle in settings
- Email/SMS alerting integration for accident events
- Multi-camera dashboard view
- User authentication & per-user analysis history

---

## [3.0.0] – 2026-04-16

### Added
- **Analytics Dashboard** with per-vehicle speed & probability charts (Recharts)
- **Accident Clip Export** – auto-saves a short clip around each detected accident
- **CSV Export** – full vehicle tracking data downloadable per analysis
- **WebSocket Live Stream** – real-time frame-by-frame detection via Django Channels
- **Collision Probability Model** – sigmoid-based pairwise risk scoring
- **Health check API endpoint** (`GET /api/health/`) for uptime monitoring
- `CHANGELOG.md` added to track releases

### Changed
- Upgraded object detection model from YOLOv5 to **YOLOv8** (Ultralytics 8.0+)
- Migrated frontend from class components to **React 19 functional components**
- Background video processing now handled by **Celery** (was synchronous)
- Logger initialisation in `views.py` moved above first usage to fix potential `NameError`

### Fixed
- `logger` referenced before assignment in `test_upload` view
- CORS headers not applied to WebSocket upgrade requests
- Large video uploads (>100 MB) silently truncated — raised `DATA_UPLOAD_MAX_MEMORY_SIZE`

---

## [2.0.0] – 2025-11-10

### Added
- React frontend replacing the original plain-HTML UI
- Django REST Framework API (`/api/analyses/`)
- Multi-vehicle centroid tracker with unique IDs per session
- Speed estimation (pixel → km/h conversion)

### Changed
- Backend refactored into a proper Django project structure

---

## [1.0.0] – 2025-08-01

### Added
- Initial release: single-camera YOLOv5 accident detection on pre-recorded video
- Basic Django backend serving annotated video file
- Plain HTML/CSS/JS frontend

---

*Maintainer: [Prathamesh Talele](https://github.com/prathamesh9164)*
