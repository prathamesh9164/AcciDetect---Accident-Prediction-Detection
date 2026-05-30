# ==========================================
# STAGE 1: Build React Frontend
# ==========================================
FROM node:18-alpine as frontend-builder

WORKDIR /app/frontend

# Install node dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build static bundle
COPY frontend/ .
ENV REACT_APP_API_BASE_URL=""
RUN npm run build

# ==========================================
# STAGE 2: Final Unified Service Image
# ==========================================
FROM python:3.10-slim

# Install Nginx, Redis-server, and system dependencies for OpenCV/FFmpeg
RUN apt-get update && apt-get install -y \
    nginx \
    redis-server \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for Hugging Face Spaces security compliance (UID 1000)
RUN useradd -m -u 1000 user
WORKDIR /app

# Copy built React frontend to static serving path
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# Copy Django backend
COPY backend /app/backend

# Install python requirements globally (done as root, readable by user 1000)
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy Hugging Face deploy configurations
COPY huggingface_deploy/nginx.conf /app/nginx.conf
COPY huggingface_deploy/start.sh /app/start.sh

# Prepare directory structures and open permissions for non-root execution
RUN mkdir -p /app/backend/media/videos /app/backend/media/output /app/backend/media/clips /app/backend/media/csv /app/backend/logs \
    && chown -R user:user /app \
    && chmod -R 777 /app /usr/share/nginx/html /tmp /var/log/nginx /var/lib/nginx

# Switch to the Hugging Face non-root user
USER user
ENV HOME=/home/user
ENV PATH=/home/user/.local/bin:$PATH

# Hugging Face routes incoming traffic to port 7860
EXPOSE 7860

CMD ["/app/start.sh"]
