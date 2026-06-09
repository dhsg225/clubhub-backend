import { useState, useEffect, useCallback } from 'react';
import type { Manifest } from '@clubhub/shared';

// CRIT-1: Use an env var so production Pi builds point at the real backend.
// Falls back to localhost:4000 for local development when VITE_BACKEND_URL is unset.
const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';
const POLL_INTERVAL = 15_000; // 15 seconds

// FIX-6: key is screen-specific so a Pi whose URL changes (screen_id query param)
// doesn't load a stale manifest from a different screen's localStorage entry.
function cacheKey(screenId: string) {
  return `clubhub_manifest_cache_${screenId}`;
}

function loadCache(screenId: string): Manifest | null {
  try {
    const raw = localStorage.getItem(cacheKey(screenId));
    return raw ? (JSON.parse(raw) as Manifest) : null;
  } catch {
    return null;
  }
}

function saveCache(screenId: string, m: Manifest) {
  try {
    localStorage.setItem(cacheKey(screenId), JSON.stringify(m));
  } catch {
    // storage full — ignore
  }
}

export type PlayerStatus = 'loading' | 'live' | 'offline' | 'empty';

export function useManifest(screenId = 'screen-1') {
  const [manifest, setManifest] = useState<Manifest | null>(() => loadCache(screenId));
  const [status, setStatus] = useState<PlayerStatus>('loading');

  const fetchManifest = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/manifest?screen_id=${screenId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Manifest = await res.json();

      setManifest((prev) => {
        if (!prev || prev.checksum !== data.checksum) {
          saveCache(screenId, data);
          return data;
        }
        return prev;
      });

      setStatus(data.items.length === 0 ? 'empty' : 'live');
    } catch {
      setStatus(loadCache(screenId) ? 'offline' : 'loading');
    }
  }, [screenId]);

  useEffect(() => {
    // HIGH-5: Jitter the first fetch by a random fraction of the poll interval.
    // Without this, every Pi that reboots at the same time (power outage, backend
    // restart) hammers the backend with 300 simultaneous requests every 15 seconds
    // in perfect lockstep forever. A random 0–15s startup delay spreads cold-start
    // load evenly across the full interval. Subsequent polls stay on the regular
    // 15s cadence — only the *first* fetch is delayed.
    const jitter = Math.floor(Math.random() * POLL_INTERVAL);
    let intervalId: ReturnType<typeof setInterval>;

    const timerId = setTimeout(() => {
      fetchManifest();
      intervalId = setInterval(fetchManifest, POLL_INTERVAL);
    }, jitter);

    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId); // no-op if interval never started (cleanup before jitter fired)
    };
  }, [fetchManifest]);

  return { manifest, status };
}
