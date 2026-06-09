# Emergency Override Propagation Verification Runbook

**Purpose:** Verify that a `CONSTITUTIONAL_FREEZE` or `EMERGENCY_CONTENT` override has propagated to all fleet screens. Use this immediately after issuing an emergency override, before assuming screens are showing the correct content.

---

## When to use

- After issuing a constitutional freeze (e.g., venue closure, safety event, legal hold)
- After pushing emergency content to the fleet
- After any override where time-to-compliance matters

---

## Step 1: Confirm the freeze is active in CMS

Via the health runtime endpoint:

```
GET /health/runtime
```

Check the response for `constitutional_freeze: true`.

Or directly in the database:

```sql
SELECT * FROM constitutional_freeze_active;
```

If the freeze is not showing as active, the override was not applied correctly. Do not proceed — re-issue the override before verifying propagation.

---

## Step 2: Check fleet dashboard for screens still showing old content

Query screens that may not have synced yet:

```
GET /api/v2/fleet/health/screens?status=HEALTHY
```

In the response, look for screens with:
- `corpus_version_id` != the expected emergency corpus version
- `warnings` containing `CORPUS_STALE`
- `last_corpus_sync_at` older than 2 minutes

Screens with a recent `last_corpus_sync_at` that matches the emergency corpus version are compliant.

---

## Step 3: Force-sync non-compliant screens

For each screen not yet showing the emergency corpus, issue a force-sync command:

```
POST /api/v2/screens/{screen_id}/commands
Content-Type: application/json

Body: {"command_type": "FORCE_SYNC"}
```

This causes the player to skip its normal poll interval and pull corpus immediately.

To force-sync all non-compliant screens at once, use the fleet bulk command endpoint if available, or iterate the list from Step 2.

---

## Step 4: Wait for next heartbeat cycle, then re-check

After issuing `FORCE_SYNC` commands, wait 30 seconds for the heartbeat cycle to reflect the update, then re-check:

```
GET /api/v2/fleet/health/screens?status=HEALTHY
```

Compliant screens will now show the emergency `corpus_version_id`.

---

## Step 5: Handle screens that remain non-compliant

**If screen is online (recent heartbeat) but still on old corpus:**

Issue a reboot:
```
POST /api/v2/screens/{screen_id}/commands
Content-Type: application/json

Body: {"command_type": "REBOOT_DEVICE"}
```

Wait 90 seconds after reboot, then re-check.

**If no heartbeat in 5+ minutes — screen is OFFLINE:**

The screen cannot receive remote commands. It requires physical investigation:
- Is the Pi powered on?
- Is the network connected?
- Is the Pi booting successfully?

Physical intervention is required for OFFLINE screens.

---

## SLA

All online screens should reflect the emergency override within **3 minutes** of a forced sync. Screens that remain non-compliant after 3 minutes require physical investigation.

---

## Audit verification

After all screens are confirmed compliant, run a database query to capture the compliance snapshot for the incident record:

```sql
SELECT screen_id, corpus_version_id, last_seen_at
FROM player_health_snapshots
WHERE corpus_version_id != '<expected_version_id>'
  AND last_seen_at > now() - interval '5 minutes';
```

If this query returns 0 rows, all recently-active screens are on the correct corpus version.

Screens that have not sent a heartbeat in the last 5 minutes are OFFLINE and excluded from this check — document them separately in the incident record.

---

## Escalation

If any screen is showing non-emergency content more than **10 minutes** after forced sync:

1. Attempt a reboot via remote command
2. If reboot does not resolve within 5 minutes: screen requires physical intervention at the venue
3. Document the screen's `screen_id` and `venue_id` in the incident record
4. Contact venue staff to power-cycle the display unit if remote reboot is not responding

Screens in `LOST` status (no heartbeat for >24h) cannot be remediated remotely. They will pick up the emergency corpus when they next come online.
