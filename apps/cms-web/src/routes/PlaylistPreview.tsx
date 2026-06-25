/**
 * Fullscreen Playlist Preview — real playout simulation.
 * Route: /preview/playlist/:id — no sidebar, no nav.
 * Opens in a new window from PlaylistComposer.
 * Rotates through all cards using the real template renderers (same as Pi).
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import { TemplateStub } from './ContentPreview.js';

interface CardData {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
}

interface PlaylistItem {
  content_id: string;
  duration_seconds: number;
  card: CardData | null;
}

interface NamedPlaylist {
  id: string;
  name: string;
  ordering_rule: string;
  items: PlaylistItem[];
}

interface ContentItem {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export function Component(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  const { data: playlist, isLoading, isError } = useQuery<NamedPlaylist>({
    queryKey: ['playlist-preview', id],
    queryFn: () => api.get<NamedPlaylist>(`/named_playlists/${id}`),
    enabled: !!id,
  });

  // Fetch full content data for all items (cards may only have partial data)
  const contentIds = playlist?.items.map((i) => i.content_id) ?? [];
  const { data: fullContent } = useQuery<ContentItem[]>({
    queryKey: ['content-for-preview', ...contentIds],
    queryFn: () => api.get<ContentItem[]>('/content'),
    enabled: contentIds.length > 0,
  });

  // Build a map of content_id → full content data
  const contentMap = new Map<string, ContentItem>();
  for (const c of fullContent ?? []) contentMap.set(c.id, c);

  if (isLoading) {
    return (
      <div style={overlayStyle}>
        <div style={{ color: '#fff', opacity: 0.5, fontFamily: 'system-ui', fontSize: '1rem' }}>
          Loading playlist…
        </div>
      </div>
    );
  }

  if (isError || !playlist || playlist.items.length === 0) {
    return (
      <div style={overlayStyle}>
        <div style={{ color: '#ef4444', fontFamily: 'system-ui', fontSize: '1rem' }}>
          {!playlist ? 'Playlist not found' : 'Playlist is empty'}
        </div>
      </div>
    );
  }

  return <PlaylistPlayer playlist={playlist} contentMap={contentMap} />;
}

function PlaylistPlayer({
  playlist,
  contentMap,
}: {
  playlist: NamedPlaylist;
  contentMap: Map<string, ContentItem>;
}): JSX.Element {
  const items = playlist.items;
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);

  const current = items[index % items.length];
  const durationMs = (current?.duration_seconds ?? 10) * 1000;

  // Advance to next card
  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % items.length);
    setProgress(0);
  }, [items.length]);

  // Progress timer
  useEffect(() => {
    if (paused || !current) return;
    const tick = 50;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += tick;
      setProgress(elapsed / durationMs);
      if (elapsed >= durationMs) {
        advance();
        elapsed = 0;
      }
    }, tick);

    return () => clearInterval(interval);
  }, [index, paused, current, durationMs, advance]);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'ArrowRight') { advance(); }
      if (e.key === 'ArrowLeft') { setIndex((prev) => (prev - 1 + items.length) % items.length); setProgress(0); }
      if (e.key === 'h') setHudVisible((v) => !v);
      if (e.key === 'Escape') window.close();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [advance, items.length]);

  // Auto-hide HUD after 3 seconds of inactivity
  useEffect(() => {
    if (!hudVisible) return;
    const timer = setTimeout(() => setHudVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [hudVisible, index]);

  // Show HUD on mouse move
  useEffect(() => {
    function handleMove(): void { setHudVisible(true); }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  if (!current) return <div style={overlayStyle} />;

  // Resolve full content item (prefer full data from API, fallback to playlist card data)
  const fullItem = contentMap.get(current.content_id);
  const contentItem: ContentItem = fullItem ?? {
    id: current.content_id,
    template_type: current.card?.template_type ?? 'unknown',
    data: current.card?.data ?? null,
    created_at: '',
  };

  const cardTitle = deriveTitle(contentItem);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* Real renderer — fullscreen */}
      <TemplateStub item={contentItem} />

      {/* HUD overlay — fades in/out */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        fontFamily: 'system-ui, sans-serif', fontSize: '0.8rem', color: '#fff',
        opacity: hudVisible ? 1 : 0, transition: 'opacity 0.3s',
        pointerEvents: hudVisible ? 'auto' : 'none',
        zIndex: 9999,
      }}>
        <span style={{ fontWeight: 700 }}>{index + 1}/{items.length}</span>
        <span style={{ opacity: 0.8 }}>{cardTitle}</span>
        <span style={{ opacity: 0.5 }}>{current.duration_seconds}s</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: paused ? '#1d4ed8' : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
        >
          {paused ? '▶ Play' : '⏸ Pause'}
        </button>
        <span style={{ opacity: 0.4, fontSize: '0.68rem' }}>
          Space: pause · ← → skip · H: toggle HUD · Esc: close
        </span>
      </div>

      {/* Progress bar — bottom of screen */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '3px', backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 9999 }}>
        <div style={{
          height: '100%', backgroundColor: '#3b82f6',
          width: `${progress * 100}%`, transition: 'width 50ms linear',
        }} />
      </div>

      {/* Card thumbnails — bottom strip */}
      <div style={{
        position: 'fixed', bottom: '3px', left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: '3px', padding: '0.5rem',
        opacity: hudVisible ? 1 : 0, transition: 'opacity 0.3s',
        pointerEvents: hudVisible ? 'auto' : 'none',
        zIndex: 9999,
      }}>
        {items.map((item, i) => {
          const active = i === index;
          return (
            <button
              key={item.content_id}
              type="button"
              onClick={() => { setIndex(i); setProgress(0); }}
              style={{
                width: active ? '24px' : '12px', height: '4px',
                borderRadius: '2px', border: 'none',
                backgroundColor: active ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                cursor: 'pointer', transition: 'width 0.2s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function deriveTitle(item: ContentItem): string {
  const d = item.data ?? {};
  if (typeof d.title === 'string' && d.title.trim()) return d.title;
  if (typeof d.event_name === 'string' && d.event_name.trim()) return d.event_name;
  if (typeof d.sponsor_name === 'string' && d.sponsor_name.trim()) return d.sponsor_name;
  if (typeof d.headline === 'string' && d.headline.trim()) return d.headline;
  return item.template_type.replace(/_/g, ' ');
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  backgroundColor: '#111',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
