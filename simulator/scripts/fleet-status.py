#!/usr/bin/env python3
"""Pretty-print fleet status from management API."""
import sys, json, urllib.request

mgmt = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3100'

try:
    with urllib.request.urlopen(f'{mgmt}/status', timeout=3) as r:
        d = json.load(r)
except Exception as e:
    print(f'Fleet management API not available ({e})\nIs the sim running? (make sim-start)')
    sys.exit(1)

bs = d.get('by_status', {})
live    = bs.get('live', 0)
offline = bs.get('offline', 0)
other   = sum(v for k, v in bs.items() if k not in ('live', 'offline'))

print(f'Fleet: {d["fleet_size"]} screens   live={live}  offline={offline}  other={other}')
print()
print(f'  {"SCREEN":<22} {"STATUS":<12} {"VER":<6} {"CHECKSUM":<10} {"POLLS":>6} {"OK":>5} {"FAIL":>5} {"VC":>4} {"STREAK":>7} {"LAST OK":>8}')
print('  ' + '-' * 90)

for s in d['screens']:
    if s['status'] == 'live':
        icon = '\u2713'
    elif s.get('forced_offline'):
        icon = '\u26a1'
    else:
        icon = '\u2717'
    ver = f'v{s["last_version"]}' if s['last_version'] is not None else '-'
    cs  = (s['last_checksum'] or '')[:8] or '-'
    ago = f'{s["last_ok_ago_s"]}s' if s['last_ok_ago_s'] is not None else '-'
    print(f'  {icon} {s["screen_id"]:<20} {s["status"]:<12} {ver:<6} {cs:<10} {s["poll_count"]:>6} {s["success_count"]:>5} {s["failure_count"]:>5} {s["version_changes"]:>4} {s["offline_streak"]:>7} {ago:>8}')
