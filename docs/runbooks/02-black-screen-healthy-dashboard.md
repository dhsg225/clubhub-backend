# Triage: Screen Black But Dashboard Shows HEALTHY

This is the **CHROMIUM_DEAD** failure scenario. The Chromium process died silently. The watchdog is still running and sending heartbeats, but the display is blank.

---

## Why this happens

The player runtime (`clubhub-player.service`) consists of two processes:

1. The Node.js orchestrator — handles corpus sync, heartbeat, command polling
2. Chromium — renders the actual display content via a WebSocket connection

If Chromium crashes (OOM kill, segfault, HDMI negotiation failure), the orchestrator continues running and sending heartbeats — so the fleet dashboard shows the screen as `HEALTHY` or `DEGRADED`. The only signal is the `CHROMIUM_DEAD` warning in the health snapshot, populated by the watchdog's `chromium_alive` check.

---

## Symptoms

- Physical display is blank (black screen, no content)
- Fleet dashboard shows status `HEALTHY` or `DEGRADED`
- Fleet dashboard may show `CHROMIUM_DEAD` warning
- Heartbeats are arriving normally (`last_seen_at` is recent)

---

## Step 1: Check fleet dashboard for CHROMIUM_DEAD warning

In the fleet dashboard, navigate to the screen's detail view:

```
GET /api/v2/fleet/health/screens/{screen_id}
```

Look for `"warnings": [..., "CHROMIUM_DEAD", ...]` in the response.

If `CHROMIUM_DEAD` is present, proceed directly to Step 3.

If not present but screen is still black, proceed to Step 2 to gather diagnostics.

---

## Step 2: Issue WATCHDOG_DIAGNOSTICS remote command

```
POST /api/v2/screens/{screen_id}/commands
Content-Type: application/json

Body: {"command_type": "WATCHDOG_DIAGNOSTICS"}
```

Retrieve the result from the next heartbeat or via the command history endpoint. Inspect the `chromium_alive` field in the diagnostics response:

- `chromium_alive: false` — Chromium process is dead. Proceed to Step 3.
- `chromium_alive: null` — Watchdog hasn't checked yet. Wait 30 seconds and retry.
- `chromium_alive: true` — Chromium is alive but display is blank. Check HDMI signal (Step 6).

---

## Step 3: Issue RESTART_RUNTIME remote command

This restarts the player process including Chromium:

```
POST /api/v2/screens/{screen_id}/commands
Content-Type: application/json

Body: {"command_type": "RESTART_RUNTIME"}
```

Wait 60–90 seconds for the player to restart and reconnect. Check the fleet dashboard for the screen to return to `HEALTHY` without `CHROMIUM_DEAD`.

---

## Step 4: If RESTART_RUNTIME fails, issue REBOOT_DEVICE

If the screen remains black or `CHROMIUM_DEAD` persists after 2 minutes:

```
POST /api/v2/screens/{screen_id}/commands
Content-Type: application/json

Body: {"command_type": "REBOOT_DEVICE"}
```

A full reboot takes 60–120 seconds. Monitor the fleet dashboard for the screen to come back online.

---

## Step 5: If still black after reboot — SSH and inspect logs

If the screen remains black after a full reboot, SSH into the Pi and check:

```bash
# Player service logs — look for crash/error messages
journalctl -u clubhub-player -n 100

# Confirm Chromium process state
ps aux | grep chromium

# Service status
systemctl status clubhub-player
```

Look for:
- `OOMKilled` in journald output — Chromium being killed by the kernel memory manager
- `exited with code 1` or similar crash indicators
- `DISPLAY is not set` — environment variable issue
- `ERROR:gpu_process_transport_factory.cc` — GPU driver issue (common on Pi 4 with low memory)

---

## Step 6: Check display signal

If Chromium is alive but display is blank, the HDMI connection may be the issue:

```bash
# Check HDMI status (Pi-specific command)
tvservice -s
```

Expected output when display is working:
```
state 0xa [HDMI CEA (16) RGB lim 16:9], 1920x1080 @ 60.00Hz, progressive
```

If it shows `state 0x1 [TV is off]` or similar, the display is not detected. Check:
- HDMI cable is securely connected at both ends
- Display is powered on and on the correct input source
- Try a different HDMI port or cable

---

## Step 7: If Chromium is OOM-killed, check memory

```bash
# Current memory usage
free -h

# OOM kill events in kernel log
dmesg | grep -i "oom\|killed"
```

If Chromium is being killed by the OOM manager:
- The Pi may be running other services consuming memory
- `clubhub-player` service may have a memory leak (check `memory_rss_mb` trend in fleet dashboard)
- Consider reducing Chromium memory usage via `--max-old-space-size` flag

---

## Escalation criteria

**Escalate to hardware swap** if:
- Screen remains black after a full reboot
- Chromium crashes immediately after restarting (within 60 seconds)
- OOM kills are happening with available memory > 200MB (hardware defect)
- `tvservice -s` reports display not detected with a known-good HDMI cable
- Physical inspection shows Pi LED is off or Pi is not booting

Proceed to the [Hardware Replacement Runbook](./01-hardware-replacement.md).
