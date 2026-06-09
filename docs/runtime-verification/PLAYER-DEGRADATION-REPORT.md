# Player Degradation Report

**Phase:** G.3 — Player Runtime Verification
**Date:** 2026-05-26
**Stack:** player-runtime/src/playlist-poller.ts + cms-api

---

## What Is Proven

### Polling Determinism
- 20 sequential polls to `/resolve/:screen_id` produce identical `playlist_checksum`
- PREVIEW: prefix never appears on production poll responses
- Checksum format verified: exactly 8 lowercase hex characters
- `screen_id` in response matches requested screen_id

### Offline Recovery Behavior
- **No cache + API down:** explicit `NO_CACHE` degraded state, `using_cache=false`
- **Fresh cache + API down:** graceful fallback, `using_cache=true`, checksum preserved
- **Expired cache (>72h) + API down:** `AUTONOMY_EXPIRED`, `using_cache=false` — no auto-recovery
- **Cache at 71h59m:** still within window, `using_cache=true`

### Constitutional Rule: No Silent Degraded-State Recovery
- Every degraded condition produces an explicit, non-empty `reason` string
- The `degraded` flag is always `true` during API unavailability (regardless of cache)
- The player NEVER silently substitutes stale content without explicit state annotation

### Cache Management
- Player cache written to atomic temp file (`.tmp` pattern)
- Cache includes `received_at` timestamp for autonomy window calculation
- Last-known-good checksum preserved across API outages

---

## What Remains Unproven

- Full player-runtime process integration (requires systemd + Chromium)
- WebSocket delivery of PLAYLIST_UPDATE messages to player-ui
- Emergency freeze suppression of playlist updates at runtime
- Watchdog kick mechanism during degraded state

---

## Autonomy Window
- Duration: 72 hours from last successful poll
- After expiry: player enters `AUTONOMY_EXPIRED` state, must not serve stale content
- No auto-restart logic: requires operator intervention

---

## Scripts
```bash
API_URL=http://localhost:3000 tsx scripts/validation/player-determinism.ts
tsx scripts/validation/offline-recovery.ts
tsx scripts/validation/replay-packet-integrity.ts
```

---

## Verdict: CONSTITUTIONALLY CERTIFIED
