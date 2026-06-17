#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/app/data}"
export USE_SQLITE="${USE_SQLITE:-true}"
export USE_INMEMORY_CHANNEL="${USE_INMEMORY_CHANNEL:-true}"
export DATABASE_PATH="${DATABASE_PATH:-$DATA_DIR/db.sqlite3}"
export RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-true}"
export DJANGO_ALLOWED_HOSTS="${DJANGO_ALLOWED_HOSTS:-*}"
export FRONTEND_DIST="${FRONTEND_DIST:-/app/static/frontend}"

if [ -z "${PORT}" ]; then
  echo "ERROR: PORT is not set. Remove any manual PORT override in Railway Variables,"
  echo "or set PORT to match Networking -> Target Port (usually 8080)."
  exit 1
fi

mkdir -p "$DATA_DIR/media"

echo "PORT=${PORT}"
echo "DATABASE_PATH=${DATABASE_PATH}"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Seeding catalog data..."
python manage.py seed_one_piece

echo "Checking catalog..."
python manage.py shell -c "from apps.catalog.models import Character; print(f'Database ready: {Character.objects.count()} characters in catalog')"

if [ -f "${FRONTEND_DIST}/index.html" ]; then
  echo "Frontend bundle: ok"
else
  echo "Frontend bundle: missing ${FRONTEND_DIST}/index.html"
fi

echo "Starting Daphne on 0.0.0.0:${PORT}..."
exec daphne -b 0.0.0.0 -p "${PORT}" config.asgi:application
