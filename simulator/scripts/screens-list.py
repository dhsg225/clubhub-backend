#!/usr/bin/env python3
"""List all registered screens."""
import sys, json, urllib.request

backend = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'

try:
    with urllib.request.urlopen(f'{backend}/screens', timeout=5) as r:
        screens = json.load(r)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)

print(f'{len(screens)} screens:')
for s in screens:
    seen  = (s.get('last_seen_at') or 'never')[:19]
    group = s.get('screen_group') or '-'
    print(f'  {s["id"]:<25} venue={s["venue_id"]:<20} group={group:<15} last_seen={seen}')
