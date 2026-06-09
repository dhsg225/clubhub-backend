import React, { useState, useEffect, useRef } from 'react';
import { resolveRenderer } from '@clubhub/shared';
import type { ManifestItem } from '@clubhub/shared';
import { useManifest } from './useManifest';
import { FullscreenRenderer } from './FullscreenRenderer';

const SCREEN_ID = new URLSearchParams(window.location.search).get('screen_id') ?? 'screen-1';

export default function App() {
  const { manifest, status } = useManifest(SCREEN_ID);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advance slide after its duration expires
  useEffect(() => {
    if (!manifest || manifest.items.length === 0) return;

    const item = manifest.items[index % manifest.items.length];
    // FIX-5: clamp to minimum 3s — a 0/1s duration causes a tight setTimeout loop
    // that locks up Chromium on the Pi even if the backend validation is bypassed.
    const duration = Math.max(item?.duration ?? 10, 3) * 1000;

    timerRef.current = setTimeout(() => {
      setIndex(i => (i + 1) % manifest.items.length);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [manifest, index]);

  // Reset to slide 0 when manifest checksum changes
  const prevChecksum = useRef<string | null>(null);
  useEffect(() => {
    if (!manifest) return;
    if (prevChecksum.current !== null && prevChecksum.current !== manifest.checksum) {
      setIndex(0);
    }
    prevChecksum.current = manifest.checksum;
  }, [manifest?.checksum]);

  const item: ManifestItem | undefined =
    manifest?.items[index % (manifest?.items.length || 1)];

  // Resolve renderer for this item's template type + version
  const Renderer = item
    ? resolveRenderer(item.type, item.template_version ?? 1)
    : null;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#000', position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Slide ── */}
      {item && Renderer && (
        <div style={{ width: '100%', height: '100%' }}>
          <FullscreenRenderer
            data={item.data as unknown as Record<string, unknown>}
            Renderer={Renderer}
          />
        </div>
      )}

      {/* ── Unknown template — skip handled by timer; show nothing ── */}
      {item && !Renderer && (() => {
        console.warn(`[player] unknown template: ${item.type}:${item.template_version ?? 1}`);
        return null;
      })()}

      {/* ── Loading / empty states ── */}
      {status === 'loading' && !manifest && (
        <Overlay icon="⏳" title="Connecting…" sub="Fetching manifest from server" />
      )}
      {status === 'empty' && (
        <Overlay icon="📋" title="No Content" sub="Playlist is empty. Add slides in Studio." />
      )}

      {/* ── Offline banner ── */}
      {status === 'offline' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(220,60,60,0.9)', color: '#fff',
          padding: '8px 16px', fontSize: 13, fontFamily: 'monospace',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>⚠ Backend offline — playing from cache</span>
          <span style={{ opacity: 0.7 }}>v{manifest?.version}</span>
        </div>
      )}

      {/* ── Debug HUD (dev only) ── */}
      {import.meta.env.DEV && manifest && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(0,0,0,0.6)', color: '#e8ff6a',
          fontSize: 11, fontFamily: 'monospace', padding: '4px 8px', borderRadius: 4,
        }}>
          {SCREEN_ID} · v{manifest.version}
          {manifest.checksum && ` · ${manifest.checksum}`}
          {' · '}{(index % manifest.items.length) + 1}/{manifest.items.length}
          {item?.source && ` · ${item.source}`}
        </div>
      )}
    </div>
  );
}

function Overlay({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0d0d0d', color: '#fff',
      fontFamily: 'system-ui, sans-serif', gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#666' }}>{sub}</div>
    </div>
  );
}
