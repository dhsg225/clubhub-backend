#!/usr/bin/env python3
"""List all schedules."""
import sys, json, urllib.request

backend = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'

try:
    with urllib.request.urlopen(f'{backend}/schedules', timeout=5) as r:
        items = json.load(r)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)

print(f'{len(items)} schedules:')
for s in items:
    if s['screen_id']:
        target = f'screen={s["screen_id"]}'
    elif s['venue_id']:
        target = f'venue={s["venue_id"]}'
    else:
        target = 'GLOBAL'

    fb     = ' [FALLBACK]' if s.get('is_fallback') else ''
    window = ''
    if s.get('time_of_day_start'):
        window = f' {s["time_of_day_start"]}-{s["time_of_day_end"]}'
    if s.get('days_of_week'):
        window += f' days={s["days_of_week"]}'
    if s.get('starts_at'):
        window += f' from={s["starts_at"][:10]}'

    print(f'  {str(s["id"])[:8]}... p={s["priority"]:3} {target:<30}{fb}{window}  content={str(s["content_id"])[:8]}...')
