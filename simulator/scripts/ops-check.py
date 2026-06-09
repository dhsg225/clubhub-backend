#!/usr/bin/env python3
"""Quick ops health check: backend readiness + screen staleness summary."""
import sys, json, urllib.request
from datetime import datetime, timezone

BACKEND = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'

def fetch(path):
    try:
        with urllib.request.urlopen(f'{BACKEND}{path}', timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        return {'_error': str(e)}

print('=== Backend Health ===')
health = fetch('/health/ready')
if '_error' in health:
    print(f'  ERROR: {health["_error"]}')
else:
    print(f'  status:          {health.get("status")}')
    print(f'  version:         {health.get("version")}')
    print(f'  uptime:          {health.get("uptime_s")}s')
    checks = health.get('checks', {})
    db = checks.get('db', {})
    cache = checks.get('manifest_cache', {})
    print(f'  db:              {db.get("status")} ({db.get("latency_ms")}ms)')
    print(f'  manifest_cache:  {cache.get("status")} ({cache.get("cached_screens")} screens)')
    mem = health.get('memory', {})
    print(f'  memory:          {mem.get("heap_used_mb")}MB heap / {mem.get("rss_mb")}MB rss')

print('')
print('=== Screens (last seen) ===')
screens = fetch('/screens')
if isinstance(screens, dict) and '_error' in screens:
    print(f'  ERROR: {screens["_error"]}')
else:
    now = datetime.now(timezone.utc)
    for s in (screens if isinstance(screens, list) else []):
        sid = s.get('id', '?')
        name = s.get('name', '')
        if s.get('last_seen_at'):
            last = datetime.fromisoformat(s['last_seen_at'].replace('Z', '+00:00'))
            age = int((now - last).total_seconds() // 60)
            status = 'STALE' if age > 30 else 'OK   '
            print(f'  {status}  {sid:30}  {age}m ago  ({name})')
        else:
            print(f'  NEVER  {sid:30}  never seen  ({name})')
