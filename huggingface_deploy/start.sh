#!/bin/bash

echo "============================================="
echo "   STARTING ACCIDETECT IN HUGGING FACE SPACE "
echo "============================================="

# 1. Start Redis Server
echo "Starting Redis server in background..."
redis-server --port 6379 --dir /tmp --daemonize yes

# 2. Prepare folders and apply Django migrations
echo "Setting up directories and Django migrations..."
cd /app/backend
mkdir -p media/videos media/output media/clips media/csv logs
chmod -R 777 media logs

# Run Django migrations to ensure database state is up to date
python manage.py migrate --noinput

# 3. Start Django Channels / Daphne server in the background
echo "Starting Daphne ASGI server on port 8000..."
daphne -b 127.0.0.1 -p 8000 accident_detection.asgi:application > /app/backend/logs/daphne.log 2>&1 &
DAPHNE_PID=$!

# 4. Start Celery worker in the background
echo "Starting Celery worker (PyTorch & YOLOv8 context)..."
celery -A accident_detection worker --loglevel=info > /app/backend/logs/celery.log 2>&1 &
CELERY_PID=$!

# 5. Start Nginx in the foreground to keep container running
echo "Starting Nginx reverse proxy on port 7860..."
nginx -c /app/nginx.conf -g "daemon off;"
