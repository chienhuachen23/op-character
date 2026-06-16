FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Same-origin deploy: API/WS use relative URLs in production build.
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    nginx \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /frontend/dist /app/static/frontend
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh \
    && rm -f /etc/nginx/sites-enabled/default

ENV DATA_DIR=/app/data \
    USE_SQLITE=true \
    USE_INMEMORY_CHANNEL=true \
    DJANGO_DEBUG=false \
    PORT=8080

EXPOSE 8080

CMD ["/start.sh"]
