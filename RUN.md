# ClubHub TV — Local Dev Run Guide

## Prerequisites

- Docker Desktop running
- Node.js 18+ installed
- npm 8+ (workspaces support)

---

## Step 1 — Install all JS dependencies (one command from root)

```bash
cd /Users/admin/Dropbox/Development/clubhub_player
npm install
```

This installs shared, studio, and player (workspace packages) in one shot.

---

## Step 2 — Start Postgres + Backend (Docker)

```bash
docker compose up
```

First run will pull Postgres image and build the backend image (~30s).

Verify backend is up:
```bash
curl http://localhost:4000/health
# → {"status":"ok","db":"connected",...}
```

---

## Step 3 — Start Studio (React CMS)

In a new terminal tab:

```bash
cd /Users/admin/Dropbox/Development/clubhub_player
npm run dev --workspace=studio
# Studio → http://localhost:3001
```

---

## Step 4 — Start Player (Raspberry Pi simulation)

In a new terminal tab:

```bash
cd /Users/admin/Dropbox/Development/clubhub_player
npm run dev --workspace=player
# Player → http://localhost:3000
```

Open in kiosk mode (full-screen Chromium simulation):

```bash
open -a "Google Chrome" --args --kiosk http://localhost:3000
```

Or standard browser tab:
```bash
open http://localhost:3000
```

---

## Full Workflow

1. Open Studio at **http://localhost:3001**
2. Click **Create** tab → fill in Headline, Sub-headline, optional image
3. Click **Save Content**
4. Click **Playlist** tab → click **Publish Playlist**
5. Watch **http://localhost:3000** — player polls every 15s and picks up the change automatically

---

## Running backend locally (without Docker)

If you prefer to run the backend outside Docker (postgres must still be running via Docker):

```bash
# Start only postgres:
docker compose up postgres

# Run backend locally:
cd backend
npm install
npm run dev
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /content | Create content item |
| GET | /content | List all content |
| GET | /content/:id | Get single content |
| DELETE | /content/:id | Delete content |
| POST | /playlist/generate | Build & publish manifest |
| GET | /manifest?screen_id=X | Fetch manifest (player polls this) |
| POST | /asset/upload | Upload image (multipart/form-data) |

---

## Multiple Screens

Pass `?screen_id=screen-2` to the player URL to simulate a second device:

```
http://localhost:3000?screen_id=screen-2
```

Publish a different playlist to `screen-2` in Studio's Playlist tab.

---

## Architecture

```
Backend (authoritative)
    ↑ POST content/playlist
Studio (CMS)
    ↓ GET /manifest every 15s
Player (dumb renderer — no CMS logic)
```

The Player ONLY fetches a manifest and renders slides. It makes zero business decisions.
