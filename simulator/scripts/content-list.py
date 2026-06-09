#!/usr/bin/env python3
"""List all content items with lifecycle status."""
import sys, json, urllib.request

backend = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'

try:
    with urllib.request.urlopen(f'{backend}/content', timeout=5) as r:
        items = json.load(r)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)

print(f'{len(items)} content items:')
for i in items:
    headline = i['data'].get('headline', '?')[:50]
    print(f'  {i["id"][:8]}... [{i["status"]:12}] "{headline}"')
