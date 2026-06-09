import React, { useEffect, useState } from 'react';
import { listContent, deleteContent, createSchedule } from '../api';
import { ScheduleModal } from './ScheduleModal';

interface ContentRow {
  id:            string;
  template_type: string;
  data:          { headline?: string; subheadline?: string; image?: string };
  created_at:    string;
  status?:       'draft' | 'scheduled' | 'active' | 'expired';
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#1e1e1e', color: '#555',    label: 'Draft'     },
  scheduled: { bg: '#1a1a2a', color: '#6b9fff', label: 'Scheduled' },
  active:    { bg: '#1a2a1a', color: '#6bff8a', label: 'Live'      },
  expired:   { bg: '#1e1a1a', color: '#666',    label: 'Expired'   },
};

export function ContentTab() {
  const [items,      setItems]      = useState<ContentRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [scheduling, setScheduling] = useState<ContentRow | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await listContent());
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this content? Any attached schedules will also be removed.')) return;
    try {
      await deleteContent(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: unknown) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  }

  async function handleScheduleSave(payload: object) {
    await createSchedule(payload);
    await load(); // refresh status badges
  }

  if (loading) return <div className="card"><p style={{ color: '#666' }}>Loading…</p></div>;
  if (error)   return <div className="card"><div className="status-bar error">{error}</div></div>;

  return (
    <>
      {scheduling && (
        <ScheduleModal
          contentId={scheduling.id}
          headline={scheduling.data.headline ?? '(no headline)'}
          onSave={handleScheduleSave}
          onClose={() => setScheduling(null)}
        />
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Content Library</h2>
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">No content yet. Create a Promo Slide first.</div>
        ) : (
          <div className="content-list">
            {items.map((item) => {
              const s = STATUS_STYLE[item.status ?? 'draft'];
              return (
                <div key={item.id} className="content-item">
                  <div className="meta">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                      <div className="type-badge">{item.template_type.replace('_', ' ')}</div>
                      <span style={{
                        background: s.bg, color: s.color,
                        fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {s.label}
                      </span>
                    </div>
                    <div className="headline">{item.data.headline || '(no headline)'}</div>
                    {item.data.subheadline && <div className="sub">{item.data.subheadline}</div>}
                    <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => setScheduling(item)}
                    >
                      Schedule
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
