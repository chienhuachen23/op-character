#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/app/data}"
export USE_SQLITE="${USE_SQLITE:-true}"
export USE_INMEMORY_CHANNEL="${USE_INMEMORY_CHANNEL:-true}"
export DATABASE_PATH="${DATABASE_PATH:-$DATA_DIR/db.sqlite3}"
export RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-true}"
export DJANGO_ALLOWED_HOSTS="${DJANGO_ALLOWED_HOSTS:-*}"
export FRONTEND_DIST="${FRONTEND_DIST:-/app/static/frontend}"
export PORT="${PORT:-8080}"

mkdir -p "$DATA_DIR/media"

echo "Starting (PORT=${PORT}, FRONTEND_DIST=${FRONTEND_DIST})"

if [ -f "${FRONTEND_DIST}/index.html" ]; then
  echo "Frontend bundle: ok"
else
  echo "Frontend bundle: missing ${FRONTEND_DIST}/index.html"
fi

echo "Starting Daphne on 0.0.0.0:${PORT}..."
daphne -b 0.0.0.0 -p "${PORT}" config.asgi:application &
DAPHNE_PID=$!

# Give Daphne a moment to bind PORT before Railway probes it.
sleep 1

echo "Running migrations..."
python manage.py migrate --noinput

echo "Seeding catalog data..."
python manage.py seed_one_piece

echo "Startup complete. /health should return ok."
wait "${DAPHNE_PID}"
