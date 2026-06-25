/**
 * Fullscreen Screen Preview — real multi-zone playout simulation.
 * Route: /preview/screen/:screenId — no sidebar, no nav.
 * Fetches /resolve/:screenId and renders all zones with real renderers.
 * Used from: ScheduleList, VenueDashboard, LayoutEditor.
 *
 * Also supports layout-only preview: /preview/layout/:slug
 * Shows sample content in each zone to verify layout geometry.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import { TemplateStub } from './ContentPreview.js';

/* ── Types ──────────────────────────────────────────────────────────── */

interface ResolvedItem {
  content_id: string;
  duration_ms: number;
  template_type: string;
  data: Record<string, unknown>;
  zone_name: string;
}

interface ResolvedScreen {
  screen_id: string;
  screen_layout: string;
  layout_definition?: {
    grid_areas: string;
    grid_rows: string;
    grid_cols: string;
    playlist_zones: string[];
    widget_slots: { zone: string; position: string; width?: number; widget: string }[];
  };
  ticker_items: string[];
  playlist: ResolvedItem[];
  zones: Record<string, ResolvedItem[]>;
}

interface LayoutRow {
  slug: string;
  display_name: string;
  definition: {
    grid_areas: string;
    grid_rows: string;
    grid_cols: string;
    playlist_zones: string[];
    widget_slots: { zone: string; position: string; width?: number; widget: string }[];
  };
}

interface ContentItem {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

/* ── Screen Preview (items 3 + 4) ───────────────────────────────── */

export function Component(): JSX.Element {
  const { screenId } = useParams<{ screenId: string }>();

  const { data: resolved, isLoading, isError } = useQuery<ResolvedScreen>({
    queryKey: ['screen-preview', screenId],
    queryFn: () => api.get<ResolvedScreen>(`/resolve/${screenId}`),
    enabled: !!screenId,
    refetchInterval: 60_000,
  });

  if (isLoading) return <Overlay>Loading screen…</Overlay>;
  if (isError || !resolved) return <Overlay error>Screen not found or resolve failed</Overlay>;

  return <MultiZonePlayer resolved={resolved} />;
}

/* ── Layout Preview (item 5) ─────────────────────────────────────── */

export function LayoutPreviewComponent(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();

  const { data: layout, isLoading: layoutLoading } = useQuery<LayoutRow>({
    queryKey: ['layout-preview', slug],
    queryFn: () => api.get<LayoutRow>(`/layouts/${slug}`),
    enabled: !!slug,
  });

  // Fetch some real content to populate zones as samples
  const { data: content } = useQuery<ContentItem[]>({
    queryKey: ['content-for-layout-preview'],
    queryFn: () => api.get<ContentItem[]>('/content'),
  });

  if (layoutLoading) return <Overlay>Loading layout…</Overlay>;
  if (!layout) return <Overlay error>Layout not found</Overlay>;

  // Build a fake resolved screen using the layout + sample content
  const playlistZones = layout.definition.playlist_zones;
  const samples = content ?? [];
  const zones: Record<string, ResolvedItem[]> = {};
  for (let i = 0; i < playlistZones.length; i++) {
    const zoneName = playlistZones[i]!;
    // Distribute content across zones round-robin
    const zoneItems: ResolvedItem[] = [];
    for (let j = 0; j < samples.length; j++) {
      if (j % playlistZones.length === i) {
        const s = samples[j]!;
        zoneItems.push({
          content_id: s.id,
          duration_ms: 8000,
          template_type: s.template_type,
          data: s.data ?? {},
          zone_name: zoneName,
        });
      }
    }
    if (zoneItems.length === 0) {
      zoneItems.push({
        content_id: 'sample',
        duration_ms: 10000,
        template_type: 'promo_slide',
        data: { title: zoneName, subtitle: 'Sample content', background_color: '#1e293b', text_color: '#ffffff' },
        zone_name: zoneName,
      });
    }
    zones[zoneName] = zoneItems;
  }

  const resolved: ResolvedScreen = {
    screen_id: `layout-preview-${slug}`,
    screen_layout: slug!,
    layout_definition: layout.definition,
    ticker_items: ['Layout preview mode', `Showing: ${layout.display_name}`, `${playlistZones.length} playlist zones`],
    playlist: Object.values(zones).flat(),
    zones,
  };

  return <MultiZonePlayer resolved={resolved} layoutPreview={layout.display_name} />;
}

/* ── Multi-zone player ───────────────────────────────────────────── */

function MultiZonePlayer({
  resolved,
  layoutPreview,
}: {
  resolved: ResolvedScreen;
  layoutPreview?: string;
}): JSX.Element {
  const def = resolved.layout_definition;
  const [hudVisible, setHudVisible] = useState(true);

  // Auto-hide HUD
  useEffect(() => {
    if (!hudVisible) return;
    const t = setTimeout(() => setHudVisible(false), 4000);
    return () => clearTimeout(t);
  }, [hudVisible]);

  useEffect(() => {
    const handler = (): void => setHudVisible(true);
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.close();
      if (e.key === 'h') setHudVisible((v) => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!def) {
    // No layout definition — single zone fallback
    const items = resolved.playlist;
    if (items.length === 0) return <Overlay>No content scheduled for this screen</Overlay>;
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <ZoneRotator items={items} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#000',
      display: 'grid',
      gridTemplateAreas: def.grid_areas,
      gridTemplateRows: def.grid_rows,
      gridTemplateColumns: def.grid_cols,
      overflow: 'hidden',
    }}>
      {/* Playlist zones */}
      {def.playlist_zones.map((zoneName) => {
        const zoneItems = resolved.zones[zoneName] ?? [];
        return (
          <div key={zoneName} style={{ gridArea: zoneName, position: 'relative', overflow: 'hidden' }}>
            {zoneItems.length > 0 ? (
              <ZoneRotator items={zoneItems} />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontFamily: 'system-ui', fontSize: '0.85rem' }}>
                {zoneName} — no content
              </div>
            )}
          </div>
        );
      })}

      {/* Widget zones (ticker, clock) */}
      {def.widget_slots.length > 0 && (() => {
        // Group by zone
        const byZone = new Map<string, typeof def.widget_slots>();
        for (const slot of def.widget_slots) {
          const arr = byZone.get(slot.zone) ?? [];
          arr.push(slot);
          byZone.set(slot.zone, arr);
        }
        return [...byZone.entries()].map(([zoneName, slots]) => (
          <div key={zoneName} style={{
            gridArea: zoneName, backgroundColor: '#111827',
            display: 'flex', alignItems: 'center', overflow: 'hidden',
          }}>
            {slots.map((slot, i) => {
              if (slot.widget === 'clock') {
                return <ClockWidget key={i} width={slot.width ?? 120} />;
              }
              if (slot.widget === 'ticker_scroll') {
                return <TickerWidget key={i} items={resolved.ticker_items} />;
              }
              return <div key={i} style={{ flex: 1, color: '#6b7280', textAlign: 'center', fontSize: '0.7rem' }}>{slot.widget}</div>;
            })}
          </div>
        ));
      })()}

      {/* HUD */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        padding: '0.5rem 1rem', fontFamily: 'system-ui', fontSize: '0.75rem', color: '#fff',
        display: 'flex', gap: '1rem', alignItems: 'center',
        opacity: hudVisible ? 1 : 0, transition: 'opacity 0.3s',
        pointerEvents: hudVisible ? 'auto' : 'none',
      }}>
        <span style={{ fontWeight: 700 }}>{layoutPreview ? `Layout: ${layoutPreview}` : resolved.screen_id}</span>
        <span style={{ opacity: 0.5 }}>{resolved.screen_layout}</span>
        <span style={{ opacity: 0.5 }}>{def.playlist_zones.length} zones</span>
        <div style={{ flex: 1 }} />
        <span style={{ opacity: 0.4, fontSize: '0.65rem' }}>H: toggle HUD · Esc: close</span>
      </div>
    </div>
  );
}

/* ── Zone rotator — rotates cards within a single zone ────────────── */

function ZoneRotator({ items }: { items: ResolvedItem[] }): JSX.Element {
  const [index, setIndex] = useState(0);
  const current = items[index % items.length];

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(advance, current.duration_ms);
    return () => clearTimeout(timer);
  }, [index, current, advance]);

  if (!current) return <></>;

  const contentItem: ContentItem = {
    id: current.content_id,
    template_type: current.template_type,
    data: current.data,
    created_at: '',
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TemplateStub item={contentItem} />
    </div>
  );
}

/* ── Simple widget implementations for preview ────────────────────── */

function ClockWidget({ width }: { width?: number }): JSX.Element {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: width ? `${width}px` : '120px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'system-ui', fontSize: '1.2rem', fontWeight: 700,
      backgroundColor: '#0f172a',
    }}>
      {time}
    </div>
  );
}

function TickerWidget({ items }: { items: string[] }): JSX.Element {
  const text = items.length > 0 ? items.join('   ·   ') : 'No ticker items';
  return (
    <div style={{
      flex: 1, overflow: 'hidden', whiteSpace: 'nowrap',
      color: '#e5e7eb', fontFamily: 'system-ui', fontSize: '0.9rem',
      display: 'flex', alignItems: 'center',
      backgroundColor: '#0f172a', padding: '0 1rem',
    }}>
      <div style={{ animation: 'ticker-scroll 20s linear infinite' }}>
        {text}{'   ·   '}{text}
      </div>
      <style>{`@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

/* ── Shared overlay ──────────────────────────────────────────────── */

function Overlay({ children, error }: { children: React.ReactNode; error?: boolean }): JSX.Element {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#111',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: error ? '#ef4444' : '#fff', fontFamily: 'system-ui', fontSize: '1rem',
      opacity: 0.7,
    }}>
      {children}
    </div>
  );
}
