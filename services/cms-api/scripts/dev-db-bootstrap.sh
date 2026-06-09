#!/bin/bash
# Local development database bootstrap
# Requires: Docker running, psql available

set -e

DB_NAME="clubhub_dev"
DB_USER="clubhub"
DB_PASSWORD="clubhub"
DB_PORT=5432

echo "Starting PostgreSQL container for local development..."
docker run -d \
  --name clubhub-postgres-dev \
  -e POSTGRES_DB="${DB_NAME}" \
  -e POSTGRES_USER="${DB_USER}" \
  -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
  -p "${DB_PORT}:5432" \
  postgres:15-alpine \
  2>/dev/null || echo "Container already running"

echo "Waiting for PostgreSQL to be ready..."
sleep 3

echo "Running migrations..."
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
pnpm --filter @clubhub/cms-api migrate

echo "Local database ready at: ${DATABASE_URL}"
