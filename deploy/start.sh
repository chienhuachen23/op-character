#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/app/data}"
export USE_SQLITE="${USE_SQLITE:-true}"
export USE_INMEMORY_CHANNEL="${USE_INMEMORY_CHANNEL:-true}"
export DATABASE_PATH="${DATABASE_PATH:-$DATA_DIR/db.sqlite3}"
export RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-true}"

mkdir -p "$DATA_DIR/media"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Seeding catalog data..."
python manage.py seed_one_piece

export PORT="${PORT:-8080}"
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting Daphne on :8001..."
daphne -b 127.0.0.1 -p 8001 config.asgi:application &

sleep 2

echo "Starting Nginx on :${PORT}..."
exec nginx -g 'daemon off;'
