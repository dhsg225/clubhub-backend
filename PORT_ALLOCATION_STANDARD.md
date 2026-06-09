# Port Allocation Standard

Single source of truth for port assignments across all services and processes.
Check this before starting any local dev process. Conflicts cause test failures (e.g. VT-01).

## Assigned Ports

| Port | Service | Process | Notes |
|------|---------|---------|-------|
| 3000 | **RESERVED — do not assign** | — | Too many tools default here (React dev server, Next.js, etc). Intentionally left free to avoid conflicts. |
| 3001 | cms-api (services) | `services/cms-api` | ⚠️ Also used by player-runtime UiServer — see conflict below |
| 3100 | api-gateway | `services/api-gateway` | Moved off 3000 deliberately |
| 3003 | replay-service | `services/replay-service` | |
| 3004 | entropy-service | `services/entropy-service` | |
| 3005 | shadow-service | `services/shadow-service` | |
| 3006 | audit-service | `services/audit-service` | |
| 4000 | backend (legacy) | `backend/src/index.js` | Express — pre-services layer |
| 5432 | postgres | Docker / local pg | |
| 7777 | player-runtime WS | `player-runtime/src/index.ts` | WebSocket server |

## ⚠️ Known Conflict: Port 3001

`player-runtime` UiServer (`player-runtime/src/index.ts`) binds to port 3001 by default (`CHROMIUM_URL=http://localhost:3001`).
`services/cms-api` also binds to port 3001.

**Rule**: Never run `player-runtime` and `services/cms-api` on the same host without overriding one.
- Override player-runtime: set `CHROMIUM_URL=http://localhost:3002` and update UiServer port accordingly.
- Integration harness: uses Docker networking — no conflict inside compose.
- Local dev: kill any process on 3001 before running validate-runner.mjs (`lsof -ti:3001 | xargs kill`).

## Checking for conflicts

```bash
# See what's on a port
lsof -i :3001

# Kill whatever is on a port
lsof -ti:3001 | xargs kill

# Check all assigned ports at once
for p in 3001 3003 3004 3005 3006 3100 4000 7777; do
  echo -n "Port $p: "; lsof -ti:$p && echo "IN USE" || echo "free"
done
```
