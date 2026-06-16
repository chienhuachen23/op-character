#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/app/data}"
export USE_SQLITE="${USE_SQLITE:-true}"
export USE_INMEMORY_CHANNEL="${USE_INMEMORY_CHANNEL:-true}"
export DATABASE_PATH="${DATABASE_PATH:-$DATA_DIR/db.sqlite3}"
export RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-true}"
export DJANGO_ALLOWED_HOSTS="${DJANGO_ALLOWED_HOSTS:-*}"
export PORT="${PORT:-8080}"

mkdir -p "$DATA_DIR/media"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Seeding catalog data..."
python manage.py seed_one_piece

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -t

echo "Starting Daphne on :8001..."
daphne -b 127.0.0.1 -p 8001 config.asgi:application &

python - <<'PY'
import time
import urllib.request

time.sleep(1)

url = "http://127.0.0.1:8001/api/v1/game-modes"
for i in range(90):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            if response.status == 200:
                print("Daphne is ready")
                break
    except Exception as exc:
        if i % 10 == 0:
            print(f"Waiting for Daphne... ({i}s) {exc}")
        time.sleep(1)
else:
    raise SystemExit("Daphne did not become ready in time")
PY

echo "Starting Nginx on 0.0.0.0:${PORT} (foreground)..."
exec nginx -g 'daemon off;'
