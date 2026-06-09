# ClubHub TV — First Pilot Venue Checklist

Use this checklist before deploying to a real venue. Each item should be ticked off
and initialled. Do not proceed to live deployment until all items are PASS.

---

## 1. Hardware Checklist

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1 | Raspberry Pi 4B (2GB+) or Pi 5 — not Pi 3 | [ ] | Pi 3 struggles with Chromium kiosk |
| 1.2 | Pi has a heatsink or case with cooling | [ ] | Overheating causes spontaneous reboots |
| 1.3 | Power supply is official Pi PSU (5.1V/3A) | [ ] | Cheap PSUs cause undervoltage and crashes |
| 1.4 | MicroSD card is Class 10 / A1 rated or better | [ ] | Slow cards cause boot delays and corruption |
| 1.5 | MicroSD card is 16GB+ | [ ] | 8GB is not enough for OS + logs |
| 1.6 | HDMI cable is HDMI 2.0 capable | [ ] | Required for 4K TVs even at 1080p |
| 1.7 | HDMI cable length is < 5m OR has active booster | [ ] | Long passive cables cause signal degradation |
| 1.8 | TV is confirmed to accept HDMI signal from Pi | [ ] | Test with Pi before mounting |
| 1.9 | Pi is mounted securely (not hanging by cable) | [ ] | Vibration causes SD card issues |
| 1.10 | Pi and TV are on a UPS or surge protector | [ ] | Power spikes kill SD cards |

---

## 2. Network Checklist

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1 | Pi uses wired Ethernet, not WiFi | [ ] | WiFi is unreliable in bar/venue environments |
| 2.2 | If WiFi is used: 5GHz band, WPA2 or WPA3 | [ ] | 2.4GHz is congested in venue environments |
| 2.3 | Pi can reach backend URL (test from Pi terminal) | [ ] | `curl http://<backend>/health` |
| 2.4 | Backend URL is LAN IP or domain — NOT `localhost` | [ ] | Localhost on Pi refers to the Pi itself |
| 2.5 | Venue router does not block outbound port 443 | [ ] | Required if backend is on public internet |
| 2.6 | Pi has a static IP or DHCP reservation | [ ] | Prevents IP changes breaking configurations |
| 2.7 | Remote access to Pi is configured (SSH) | [ ] | Required for remote diagnosis and updates |
| 2.8 | Pi OS firewall allows SSH from ops subnet | [ ] | `sudo ufw allow from <ops-ip> to any port 22` |
| 2.9 | Internet failover is documented | [ ] | What happens if venue internet goes down? |
| 2.10 | Bandwidth: at least 1 Mbps available for Pi | [ ] | Manifest is JSON only; images are cached |

---

## 3. TV / Display Checklist

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1 | TV is set to correct HDMI input permanently | [ ] | Not on "auto input" which can switch |
| 3.2 | TV `HDMI-CEC` / `Anynet+` is disabled | [ ] | CEC can turn Pi off when TV goes to standby |
| 3.3 | TV auto-off timer is disabled | [ ] | TVs in venues must not turn off on timer |
| 3.4 | TV brightness and contrast are set for ambient light | [ ] | Tune in the actual room lighting |
| 3.5 | TV input label shows "ClubHub" (cosmetic) | [ ] | Prevents staff confusion |
| 3.6 | TV native resolution matches Pi output (1080p/4K) | [ ] | Mismatched res causes overscan/pillarbox |
| 3.7 | TV overscan is disabled (`HDMI Full Pixel` or equiv) | [ ] | Prevents clipped edges on content |
| 3.8 | Content looks correct on the display (no color shift) | [ ] | Some TVs have aggressive colour profiles |

---

## 4. Kiosk Mode Checklist (Chromium on Pi)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1 | Chromium launches automatically on boot | [ ] | via `~/.config/autostart/kiosk.desktop` or `~/.bashrc` |
| 4.2 | Chromium opens in kiosk mode (fullscreen, no UI chrome) | [ ] | `chromium-browser --kiosk <url>` |
| 4.3 | Correct screen URL is set (includes `?screen_id=...`) | [ ] | e.g. `http://192.168.1.10:4000/player?screen_id=bar-01` |
| 4.4 | Screen goes back to kiosk if Chromium crashes | [ ] | Use `--app` flag + systemd service restart |
| 4.5 | No mouse cursor is visible | [ ] | Install `unclutter-xfixes` or set cursor to blank |
| 4.6 | No desktop notifications or OS pop-ups appear | [ ] | Disable notification daemon |
| 4.7 | Screen does not go to screensaver or DPMS off | [ ] | `xset s off; xset -dpms; xset s noblank` in autostart |
| 4.8 | Pi auto-logs in to kiosk user on boot | [ ] | `raspi-config → Boot → Desktop → Autologin` |
| 4.9 | Pi does not prompt for OS updates | [ ] | Disable `apt-daily.service` or set to manual |
| 4.10 | Content is visible and cycling correctly | [ ] | Confirm content appears, duration is correct |

---

## 5. Remote Access Checklist

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1 | SSH key-based auth is configured (no password auth) | [ ] | `~/.ssh/authorized_keys` on Pi |
| 5.2 | SSH password auth is disabled | [ ] | `PasswordAuthentication no` in `/etc/ssh/sshd_config` |
| 5.3 | Pi's SSH port is accessible from ops network | [ ] | Test: `ssh pi@<ip>` from ops machine |
| 5.4 | Ops team has a documented IP address or hostname for each Pi | [ ] | Spreadsheet or asset tracking system |
| 5.5 | VPN or bastion host access is configured if Pi is behind NAT | [ ] | WireGuard or Tailscale recommended |
| 5.6 | Remote reboot is tested and working | [ ] | `ssh pi@<ip> sudo reboot` |
| 5.7 | Remote log inspection is tested | [ ] | `ssh pi@<ip> journalctl -u kiosk -f` |
| 5.8 | Chromium can be restarted remotely | [ ] | `ssh pi@<ip> sudo systemctl restart kiosk` |

---

## 6. Recovery Testing Checklist

Run these tests BEFORE the venue goes live. Every test must PASS.

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 6.1 | Power off the Pi and power it back on | Content resumes in < 60s | [ ] |
| 6.2 | Pull the ethernet cable for 60s, reconnect | Content continues from cache, then resumes live within 15s of reconnect | [ ] |
| 6.3 | Restart the backend service | Content continues from cache; resumes within 30s | [ ] |
| 6.4 | Reboot the backend server | Content plays from cache; Pi resumes live within 2 minutes | [ ] |
| 6.5 | Delete all scheduled content | System fallback slide (`"Welcome"`) appears | [ ] |
| 6.6 | Create a new content item and schedule it | Pi detects new content within 15s (one poll cycle) | [ ] |
| 6.7 | Simulate total internet outage (pull Pi network for 5 min) | Content plays from cache the entire time | [ ] |
| 6.8 | Run chaos test suite against the live stack | All 13 tests pass: `make test-ci` | [ ] |
| 6.9 | Confirm backup is taken and restore has been tested | Restore completes, content is intact | [ ] |
| 6.10 | Verify remote access works from outside venue network | SSH session established and Chromium restarted | [ ] |

---

## Pre-Go-Live Sign-Off

| Item | Name | Date |
|------|------|------|
| Hardware installed and tested | | |
| Network configured and static IP set | | |
| Kiosk mode verified on display | | |
| Remote access confirmed | | |
| Recovery tests all passed | | |
| Backup taken and restore tested | | |
| Content scheduled and verified on screen | | |

**Go-live approved by:** _____________________________ **Date:** ______________
