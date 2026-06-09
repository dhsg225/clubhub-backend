#!/usr/bin/env bash
# Wave 1 bootstrap — starts postgres, runs migrations, seeds fixtures
set -euo pipefail

echo "[bootstrap] Starting Wave 1 database bootstrap..."

# Start postgres
docker-compose -f docker-compose.dev.yml up -d postgres

# Wait for postgres to be ready
echo "[bootstrap] Waiting for PostgreSQL..."
until docker exec clubhub-postgres-dev pg_isready -U clubhub_app -d clubhub 2>/dev/null; do
  sleep 1
done
echo "[bootstrap] PostgreSQL is ready"

# Set env vars for migration runner
export DB_HOST=127.0.0.1
export DB_PORT=5433
export DB_NAME=clubhub
export DB_USER=clubhub_app
export DB_PASSWORD=devpassword

# Run migrations
echo "[bootstrap] Running migrations..."
cd services/cms-api && pnpm db:migrate

# Seed fixtures
echo "[bootstrap] Seeding Wave 1 fixtures..."
pnpm db:seed

echo "[bootstrap] Bootstrap complete!"
echo "[bootstrap] Screen ID: 60000000-0000-0000-0000-000000000001"
echo "[bootstrap] Run: DB_HOST=127.0.0.1 DB_PORT=5433 DB_NAME=clubhub DB_USER=clubhub_app DB_PASSWORD=devpassword pnpm dev"
