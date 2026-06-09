#!/usr/bin/env python3
"""Fetch and pretty-print a manifest for a given screen."""
import sys, json, urllib.request

backend   = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'
screen_id = sys.argv[2] if len(sys.argv) > 2 else 'sim-screen-01'

try:
    url = f'{backend}/manifest?screen_id={screen_id}'
    with urllib.request.urlopen(url, timeout=5) as r:
        d = json.load(r)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)

print(f'screen_id:  {d["screen_id"]}')
print(f'venue_id:   {d.get("venue_id", "-")}')
print(f'version:    {d["version"]}')
print(f'checksum:   {d.get("checksum", "-")}')
print(f'computed:   {d.get("computed_at", "-")}')
print(f'valid_until:{d.get("valid_until", "-")}')
print()
print(f'items ({len(d["items"])}):')
for i in d['items']:
    prio = f' p{i["priority"]}' if i.get('priority') is not None else ''
    print(f'  [{i["source"]}{prio}]  {i["duration"]}s  "{i["data"].get("headline", "?")}"')

fb = d.get('fallback_items', [])
if fb:
    print()
    print(f'fallback_items ({len(fb)}):')
    for i in fb:
        print(f'  [{i["source"]}]  {i["duration"]}s  "{i["data"].get("headline", "?")}"')
