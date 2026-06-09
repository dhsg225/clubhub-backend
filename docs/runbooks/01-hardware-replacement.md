# Hardware Replacement Runbook

**Use when:** A Pi is physically replaced due to hardware failure, theft, or damage.

---

## Prerequisites

- Access to CMS operator UI (L2+ role)
- Replacement Pi with a freshly flashed ClubHub image (same SD card image as original)
- Physical access to the venue AV cabinet (or a field tech on-site)

---

## Step 1: Issue a re-enrollment token via CMS API

The replacement Pi must reclaim the same `screen_id` and venue slot. Do this by issuing a re-enrollment token for the screen being replaced.

```
POST /api/v2/screens/{screen_id}/re-enrollment-token
Content-Type: application/json

Body:
{
  "reason": "Pi hardware failure - SD card corrupted",
  "issued_by": "operator@venue.com"
}

Response:
{
  "token": "...",
  "expires_at": "...",
  "token_id": "...",
  "screen_id": "...",
  "screen_name": "...",
  "venue_id": "..."
}
```

Note the `token` value. It is displayed **once** — store it securely or pass it directly to the field tech.

**Token validity: 48 hours, single-use.**

---

## Step 2: Place the token file on the replacement Pi

Before the replacement Pi boots for the first time, write the token to the SD card at the re-enrollment path. The enrollment script checks this file on first boot:

```bash
# On the SD card (or via SSH before first boot if Pi has been started without network):
echo "TOKEN_VALUE" > /etc/clubhub/reenroll.token
```

The file must be placed at `/etc/clubhub/reenroll.token` exactly. The enrollment script reads this file and calls the re-enrollment endpoint instead of the normal enrollment flow.

---

## Step 3: Boot the replacement Pi and observe enrollment logs

Power on the replacement Pi. The `clubhub-firstboot` service will run automatically and attempt re-enrollment. Follow the logs:

```bash
journalctl -u clubhub-firstboot -f
```

Expected log sequence:
1. `Re-enrollment token found at /etc/clubhub/reenroll.token — attempting re-enrollment`
2. `Re-enrollment HTTP status: 200`
3. `Re-enrollment successful!`
4. `Re-enrolled Screen ID: <screen_id>`
5. `Re-enrollment token file removed (single-use consumed)`
6. `=== Re-enrollment complete. Player will start. ===`

---

## Step 4: Verify the same screen_id is retained in CMS

In the CMS operator dashboard, navigate to the screen. Confirm:

- `screen_id` is unchanged
- `hardware_id` has updated to the new Pi serial number
- `last_seen_at` reflects the recent boot

```
GET /api/v2/fleet/health/screens/{screen_id}
```

---

## Step 5: Verify corpus loads and heartbeat appears in fleet dashboard

Wait up to 90 seconds for the first heartbeat. In the fleet dashboard:

- Screen status should move from `OFFLINE` or `UNKNOWN` to `HEALTHY`
- `corpus_load_source` should show `current` (not `factory`) once corpus syncs
- `constitutional_state` should be `HEALTHY`

If `corpus_load_source` shows `factory` after 2 minutes, corpus sync is not completing — check network connectivity and CMS API reachability from the Pi.

---

## What is preserved after hardware replacement

| Attribute | Preserved? |
|-----------|------------|
| `screen_id` | Yes — unchanged |
| Audit history | Yes — tied to screen_id |
| Schedules | Yes — corpus bindings intact |
| Corpus bindings | Yes |
| Venue assignment | Yes |
| `hardware_id` | No — updated to new Pi serial |
| Replay cache | No — starts fresh on new hardware |

---

## Escalation

If enrollment fails after the re-enrollment token has been consumed (HTTP 409 — already used):

1. Issue a new token via the CMS API
2. Write the new token to `/etc/clubhub/reenroll.token` on the replacement Pi
3. Run: `systemctl restart clubhub-firstboot`

If the replacement Pi fails enrollment repeatedly after 3+ fresh tokens, contact L4 support. New screen provisioning (`POST /api/v2/enrollment/enroll`) may be required, which will allocate a new `screen_id` and lose the historical audit association.
