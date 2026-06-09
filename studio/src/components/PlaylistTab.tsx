import React, { useCallback, useEffect, useState } from 'react';
import { getManifest, listSchedules, deleteSchedule } from '../api';
import type { Manifest } from '@clubhub/shared';

interface ScheduleRow {
  id:               string;
  content_id:       string;
  venue_id:         string | null;
  screen_id:        string | null;
  screen_group:     string | null;
  priority:         number;
  starts_at:        string | null;
  ends_at:          string | null;
  duration:         number;
  is_fallback:      boolean;
  created_at:       string;
}

export function PlaylistTab() {
  const [manifest,  setManifest]  = useState<Manifest | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const venueId  = 'venue-1';
  const screenId = 'screen-1';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, s] = await Promise.all([
        getManifest(screenId),
        listSchedules({ venue_id: venueId }),
      ]);
      setManifest(m);
      setSchedules(s);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [screenId, venueId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Remove this schedule? The player will update within 15s.')) return;
    try {
      await deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      // Re-fetch manifest after a brief delay so engine cache expires
      setTimeout(() => getManifest(screenId).then(setManifest).catch(console.error), 6_000);
    } catch (err: unknown) {
      alert(`Failed: ${(err as Error).message}`);
    }
  }

  function formatWindow(s: ScheduleRow) {
    if (!s.starts_at && !s.ends_at) return 'Always active';
    const parts: string[] = [];
    if (s.starts_at) parts.push(`from ${new Date(s.starts_at).toLocaleString()}`);
    if (s.ends_at)   parts.push(`until ${new Date(s.ends_at).toLocaleString()}`);
    return parts.join(' ');
  }

  return (
    <div className="layout-2col" style={{ alignItems: 'start' }}>

      {/* ── Left: schedules ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Schedules</h2>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>

        {error && <div className="status-bar error">{error}</div>}

        <p style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
          Venue: <strong style={{ color: '#888' }}>{venueId}</strong>
          {' · '}Add schedules from the <strong style={{ color: '#aaa' }}>Content</strong> tab.
        </p>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="empty-state">
            No schedules yet.
            <br /><br />
            Go to <strong>Content</strong>, then click <strong>Schedule</strong> on any slide.
          </div>
        ) : (
          <div className="content-list">
            {schedules.map(s => (
              <div key={s.id} className="content-item">
                <div className="meta">
                  <div style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'center' }}>
                    <span style={{
                      background: '#1e1e1e', color: '#e8ff6a',
                      fontSize: 11, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 4,
                    }}>
                      P{s.priority}
                    </span>
                    <span style={{ fontSize: 12, color: '#888' }}>{s.duration}s</span>
                    {s.is_fallback && (
                      <span style={{
                        background: '#1a1a2a', color: '#6b9fff',
                        fontSize: 10, fontWeight: 600,
                        padding: '1px 6px', borderRadius: 4,
                        textTransform: 'uppercase',
                      }}>
                        Fallback
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#777' }}>
                    {s.screen_id
                      ? <>Screen: <strong style={{ color: '#aaa' }}>{s.screen_id}</strong></>
                      : <>Venue: <strong style={{ color: '#aaa' }}>{s.venue_id}</strong></>}
                    {s.screen_group && <> · Group: <strong style={{ color: '#aaa' }}>{s.screen_group}</strong></>}
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
                    {formatWindow(s)}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 11, padding: '5px 10px', flexShrink: 0 }}
                  onClick={() => handleDelete(s.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: live manifest ── */}
      <div className="card">
        <h2>Live Manifest</h2>

        {manifest ? (
          <>
            <div className="playlist-info">
              Screen: <strong>{manifest.screen_id}</strong>
              {manifest.venue_id && <> · Venue: <strong>{manifest.venue_id}</strong></>}
              {' · '}v<strong>{manifest.version}</strong>
              {manifest.checksum && (
                <> · <span style={{ color: '#444', fontFamily: 'monospace', fontSize: 11 }}>
                  {manifest.checksum}
                </span></>
              )}
            </div>

            {manifest.items.length === 0 ? (
              <div className="empty-state">
                No active items.
                <br />Create content and schedule it.
              </div>
            ) : (
              manifest.items.map((item, i) => (
                <div key={i} className="playlist-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong style={{ color: '#555' }}>#{i + 1}</strong>
                      {' '}
                      {(item.data as { headline?: string }).headline || '—'}
                    </span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {item.source && (
                        <span style={{
                          fontSize: 10, color: '#444',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {item.source}
                        </span>
                      )}
                      {item.priority != null && (
                        <span style={{ fontSize: 11, color: '#e8ff6a' }}>P{item.priority}</span>
                      )}
                      <span style={{ color: '#555', fontSize: 13 }}>{item.duration}s</span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {manifest.valid_until && (
              <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 14 }}>
                Engine valid until: {new Date(manifest.valid_until).toLocaleString()}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">Loading manifest…</div>
        )}
      </div>

    </div>
  );
}
