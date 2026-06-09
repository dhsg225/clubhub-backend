import React, { useState } from 'react';

interface SchedulePayload {
  content_id:   string;
  venue_id:     string;
  screen_id:    string | null;
  priority:     number;
  duration:     number;
  starts_at:    string | null;
  ends_at:      string | null;
  is_fallback:  boolean;
}

interface Props {
  contentId: string;
  headline:  string;
  onSave:    (payload: SchedulePayload) => Promise<void>;
  onClose:   () => void;
}

// FIX-3: Convert a datetime-local string ("2024-01-15T10:30", no TZ) to ISO 8601 UTC.
// `datetime-local` inputs produce a timezone-naive value. Without this conversion the
// string is sent as-is and Postgres parses it as server-local time (UTC in Docker),
// meaning an operator in UTC+8 who types "10:30 AM" gets a schedule stored at 10:30 UTC
// — which fires at 6:30 PM their time. new Date(val) lets the BROWSER apply its local
// timezone offset (the operator's machine), producing the correct UTC moment.
function toISO(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function ScheduleModal({ contentId, headline, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    venue_id:   'venue-1',
    screen_id:  '',
    priority:   10,
    duration:   10,
    starts_at:  '',
    ends_at:    '',
    is_fallback: false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSave({
        content_id:  contentId,
        venue_id:    form.venue_id,
        screen_id:   form.screen_id.trim() || null,
        priority:    Number(form.priority),
        duration:    Number(form.duration),
        starts_at:   toISO(form.starts_at), // FIX-3: browser TZ → UTC ISO string
        ends_at:     toISO(form.ends_at),   // FIX-3: browser TZ → UTC ISO string
        is_fallback: form.is_fallback,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 8, padding: '10px 14px', color: '#fff',
    fontSize: 15, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20,
    }}>
      <div className="card" style={{ width: 480, maxWidth: '100%', margin: 0 }}>
        <h2>Schedule Slide</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 20, marginTop: -8 }}>
          "{headline}"
        </p>

        {error && <div className="status-bar error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="form-group">
          <label>Venue ID</label>
          <input type="text" style={inputStyle} value={form.venue_id}
            onChange={e => set('venue_id', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Screen ID <span style={{ color: '#555', fontWeight: 400 }}>(leave blank = whole venue)</span></label>
          <input type="text" style={inputStyle} value={form.screen_id}
            placeholder="e.g. screen-1"
            onChange={e => set('screen_id', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Priority</label>
            <input type="number" style={inputStyle} value={form.priority}
              onChange={e => set('priority', Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Duration (sec)</label>
            <input type="number" style={inputStyle} value={form.duration}
              onChange={e => set('duration', Number(e.target.value))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Starts at <span style={{ color: '#555', fontWeight: 400 }}>(blank = now)</span></label>
            <input type="datetime-local" style={inputStyle} value={form.starts_at}
              onChange={e => set('starts_at', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Ends at <span style={{ color: '#555', fontWeight: 400 }}>(blank = indefinite)</span></label>
            <input type="datetime-local" style={inputStyle} value={form.ends_at}
              onChange={e => set('ends_at', e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <input
            type="checkbox" id="is_fallback"
            checked={form.is_fallback}
            onChange={e => set('is_fallback', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#e8ff6a', cursor: 'pointer' }}
          />
          <label htmlFor="is_fallback" style={{
            textTransform: 'none', fontSize: 14, color: '#bbb', cursor: 'pointer',
          }}>
            Fallback — plays only when nothing else is scheduled
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Schedule'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
