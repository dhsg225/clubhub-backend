# ClubHub TV — Deployment Guide

This guide covers every deployment scenario from local development to production VPS.

---

## Quick Reference

| Goal | Command |
|------|---------|
| Local dev + simulation | `make sim-start` |
| First-run setup | `make bootstrap` |
| Production deploy | `docker compose -f docker-compose.production.yml up -d` |
| Backup | `make backup-prod` |
| Restore | `make restore BACKUP=<file>` |
| Health check | `curl https://yourdomain.com/api/health/ready` |

---

## 1. Local Development

### Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js 20+
- `make`

### Start the development stack

```bash
# Clone the repo
cd clubhub_player

# Start postgres + backend + 5 simulated Pi screens
make sim-start

# Seed with test content
make seed

# Watch live logs
make sim-logs
```

The stack starts on:
- Backend API: `http://localhost:4000`
- Pi fleet management API: `http://localhost:3100`
- PostgreSQL: `localhost:5433` (5433 to avoid conflicts with local installs)

### Without Docker (backend only)

```bash
cd backend
cp .env .env.local         # edit DATABASE_URL to point to your postgres
npm install
npm run dev                # nodemon, auto-reloads on changes
```

---

## 2. VPS Deployment

### Server requirements
- Ubuntu 22.04+ / Debian 12+ (or any modern Linux)
- 1 vCPU, 1 GB RAM minimum (2 vCPU / 2 GB recommended for 20+ screens)
- Docker Engine 24+ and Docker Compose plugin
- Ports 80 and 443 open in your firewall
- A domain name pointed at the server's IP

### Step-by-step

#### 2.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # allow running docker without sudo
newgrp docker
```

#### 2.2 Clone and configure

```bash
git clone <repo> /opt/clubhub
cd /opt/clubhub

cp .env.production.example .env.production
```

Edit `.env.production`:

```bash
# Required
DOMAIN=clubhub.yourdomain.com
DB_PASSWORD=$(openssl rand -base64 24)
SECRET_KEY=$(openssl rand -hex 32)

# Optional
LOG_LEVEL=INFO
CADDY_ACME_EMAIL=you@example.com
```

**Never commit `.env.production` to version control.**

#### 2.3 Start the production stack

```bash
docker compose -f docker-compose.production.yml up -d
```

Caddy will automatically obtain a Let's Encrypt TLS certificate for your domain.
The first startup takes ~30 seconds for certificate provisioning.

#### 2.4 Bootstrap first venue and screen

```bash
BACKEND_URL=https://clubhub.yourdomain.com/api node scripts/bootstrap.js
```

#### 2.5 Verify

```bash
curl https://clubhub.yourdomain.com/api/health/ready
# Expected: {"status":"ok","checks":{"db":{"status":"ok"}, ...}}
```

---

## 3. Docker Production Deployment

### Architecture

```
Internet
    │
    ▼
[Caddy :80/:443]   — TLS termination, HTTP→HTTPS redirect, reverse proxy
    │
    ▼ (internal Docker network "proxy")
[Backend :4000]    — Express API, manifest engine
    │
    ▼ (internal Docker network "internal")
[PostgreSQL :5432] — Not exposed to host or internet
```

PostgreSQL and the backend are on an **isolated internal network** — they are
unreachable from outside Docker. Only Caddy is exposed on ports 80/443.

### docker-compose.production.yml highlights

- `restart: unless-stopped` on all services
- Named volumes for data persistence (`pgdata`, `uploads`, `caddy_data`)
- JSON-file log driver with 50MB rolling logs (5 files kept)
- Healthchecks on postgres (pg_isready), backend (/health/live), caddy (metrics)
- Caddy waits for backend to be healthy before accepting traffic

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DOMAIN` | Yes | Your domain (e.g. `clubhub.example.com`) or `localhost` |
| `DB_PASSWORD` | Yes | Strong postgres password |
| `SECRET_KEY` | Yes | Random hex secret (`openssl rand -hex 32`) |
| `LOG_LEVEL` | No | `DEBUG`/`INFO`/`WARN`/`ERROR` (default: `INFO`) |
| `CADDY_ACME_EMAIL` | No | Email for Let's Encrypt notifications |

---

## 4. Reverse Proxy Setup

### Caddy (included in docker-compose.production.yml)

Caddy is the default and recommended option. It handles:
- Automatic TLS via Let's Encrypt (HTTP-01 challenge)
- HTTP → HTTPS redirect
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Access logging with rotation
- Direct file serving for uploaded assets (bypasses backend)

Configuration: `docker/Caddyfile`

**For local/LAN deployments without a domain:**

```
# .env.production
DOMAIN=localhost
```

Caddy will serve plain HTTP on port 80 — no TLS certificate is requested.

### Nginx (alternative)

If you prefer nginx, here is an equivalent configuration:

```nginx
server {
    listen 80;
    server_name clubhub.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name clubhub.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/clubhub.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clubhub.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location /api/ {
        proxy_pass         http://127.0.0.1:4000/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 15s;
    }

    location /uploads/ {
        alias /opt/clubhub/uploads/;
    }
}
```

---

## 5. HTTPS

### With Caddy (automatic)

Set `DOMAIN=yourdomain.com` in `.env.production`. Caddy handles everything.

Requirements:
- DNS A record pointing `yourdomain.com` → your server's IP
- Port 80 and 443 open
- The domain must be publicly reachable (Let's Encrypt needs to verify it)

### With certbot + nginx

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d clubhub.yourdomain.com
sudo certbot renew --dry-run   # verify auto-renewal
```

### Self-signed (development / LAN only)

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj '/CN=localhost'
```

Point nginx/caddy at `key.pem` and `cert.pem`. Browsers will show a warning —
acceptable for internal network Pis.

---

## 6. Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://clubhub:clubhub@localhost:5432/clubhub` | PostgreSQL connection string |
| `PORT` | `4000` | HTTP port |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded images |
| `LOG_LEVEL` | `INFO` | Log verbosity |
| `SECRET_KEY` | — | Token signing secret (set before production) |

### Player (Pi browser)

| Variable | Description |
|----------|-------------|
| `VITE_BACKEND_URL` | Backend URL, set at build time for Pi image (e.g. `https://clubhub.yourdomain.com/api`) |

### Pi appliance simulator

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:4000` | Backend to poll |
| `SCREEN_ID` | auto-generated | Screen identifier |
| `VENUE_ID` | `venue-1` | Venue to register under |
| `IDENTITY_FILE` | `/tmp/clubhub-screen-identity.json` | Persistent identity file path |
| `CACHE_FILE` | `/tmp/clubhub-manifest-cache.json` | Local manifest cache path |
| `POLL_INTERVAL_MS` | `15000` | How often to poll the backend |
| `STALE_THRESHOLD_MS` | `120000` | Log warning if manifest is older than this |
| `WATCHDOG_THRESHOLD` | `3` | Consecutive failures before simulated watchdog restart |

---

## 7. Backup Strategy

ClubHub data lives in two places:
1. **PostgreSQL** — all configuration: venues, screens, schedules, content metadata
2. **Uploaded files** — the `uploads/` volume (images attached to content items)

### Automated backups (recommended)

Add to your server's crontab:

```cron
# Daily backup at 02:00
0 2 * * * cd /opt/clubhub && make backup-prod >> /var/log/clubhub-backup.log 2>&1
```

Or use the provided backup script directly:

```bash
USE_DOCKER=true CONTAINER_NAME=clubhub_player-postgres-1 \
  DB_PASSWORD=<your_password> \
  ./scripts/backup.sh
```

Backups are compressed `.sql.gz` files stored in `backups/`.
The script keeps the last 30 backups and verifies file integrity.

### Upload volume backup

```bash
# Backup uploads volume to a tarball
docker run --rm \
  -v clubhub_player_uploads:/data \
  -v $(pwd)/backups:/backups \
  alpine tar czf /backups/uploads_$(date +%Y-%m-%d).tar.gz -C /data .
```

### Off-site replication

For production, mirror the `backups/` directory to off-site storage:

```bash
# rsync to a remote server
rsync -avz backups/ user@backup-server:/backups/clubhub/

# Or sync to S3
aws s3 sync backups/ s3://your-bucket/clubhub-backups/
```

---

## 8. Restore Strategy

### From a compressed SQL backup

```bash
./scripts/restore.sh backups/clubhub_2026-05-15_020000.sql.gz
```

The script will:
1. Verify the backup file is not corrupt
2. Ask for confirmation
3. Drop and recreate the database
4. Restore from the dump

**Always stop the backend before restoring** to prevent partial reads:

```bash
docker compose -f docker-compose.production.yml stop backend
./scripts/restore.sh backups/clubhub_YYYY-MM-DD_HHMMSS.sql.gz
docker compose -f docker-compose.production.yml start backend
```

### Restoring uploads

```bash
docker run --rm \
  -v clubhub_player_uploads:/data \
  -v $(pwd)/backups:/backups \
  alpine sh -c "rm -rf /data/* && tar xzf /backups/uploads_2026-05-15.tar.gz -C /data"
```

### Point-in-time recovery

For critical production deployments, enable PostgreSQL WAL archiving
and use `pgBackRest` or `Barman` for point-in-time recovery. This is beyond
the scope of this guide but documented at https://pgbackrest.org/.

---

## 9. Update Strategy

### Rolling update (zero-downtime)

```bash
cd /opt/clubhub
git pull origin main

# Rebuild and restart only the backend (postgres and caddy keep running)
docker compose -f docker-compose.production.yml up -d --build --no-deps backend
```

The `--no-deps` flag prevents postgres from restarting. Caddy will buffer
requests during the backend restart (< 5 seconds).

### Full stack update

```bash
git pull origin main
docker compose -f docker-compose.production.yml up -d --build
```

### Database migrations

Run migrations after pulling new code if a `migrate_00N.sql` file was added:

```bash
docker compose -f docker-compose.production.yml exec postgres \
  psql -U clubhub clubhub -f /path/to/migrate_00N.sql
```

Or mount migration files in the postgres init directory — they run automatically
on first start only, so for existing databases you must run them manually.

---

## 10. Rollback Strategy

### Rollback application code

```bash
# Find the last working image tag
docker images | grep clubhub

# Roll back to a specific image
docker compose -f docker-compose.production.yml stop backend
docker tag <old_image_id> clubhub_player-backend:rollback
# Edit docker-compose.production.yml: image: clubhub_player-backend:rollback
docker compose -f docker-compose.production.yml start backend
```

Or if you use git tags:

```bash
git checkout v1.2.3
docker compose -f docker-compose.production.yml up -d --build --no-deps backend
```

### Rollback database

If a migration caused issues:

```bash
# Stop backend
docker compose -f docker-compose.production.yml stop backend

# Restore last known-good backup
./scripts/restore.sh backups/clubhub_$(date -d yesterday +%Y-%m-%d)_020000.sql.gz

# Start backend on the rolled-back code
git checkout v1.2.3
docker compose -f docker-compose.production.yml up -d --build --no-deps backend
```

---

## Appendix: Port Reference

| Service | Dev (sim) | Production |
|---------|-----------|------------|
| Backend API | localhost:4000 | `https://{DOMAIN}/api` |
| PostgreSQL | localhost:5433 | Not exposed (internal) |
| Pi fleet mgmt | localhost:3100 | Not in production |
| HTTP | — | 0.0.0.0:80 (→ HTTPS) |
| HTTPS | — | 0.0.0.0:443 |
