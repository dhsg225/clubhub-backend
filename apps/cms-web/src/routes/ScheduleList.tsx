/**
 * Schedule List — all schedules (content-card and playlist-based).
 * Route: /schedules
 *
 * Extends existing schedules: now includes playlist_id + playlist_name (from LEFT JOIN).
 * Legacy rows have content_id, new rows have playlist_id.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client.js';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

interface Schedule {
  id: string;
  content_id: string | null;
  playlist_id: string | null;
  playlist_name: string | null;
  venue_id: string | null;
  screen_id: string | null;
  screen_group: string | null;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: number[] | null;
  time_of_day_start: string | null;
  time_of_day_end: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function scheduleWindow(s: Schedule): string {
  if (!s.starts_at && !s.ends_at) return 'always';
  return `${formatDate(s.starts_at)} → ${formatDate(s.ends_at)}`;
}

function scheduleTarget(s: Schedule): string {
  if (s.screen_id) return `Screen: ${s.screen_id.slice(0, 12)}…`;
  if (s.venue_id) return `Venue: ${s.venue_id}`;
  return 'Global';
}

const DAY_LABELS: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

function formatDaypart(s: Schedule): string {
  if (!s.days_of_week || s.days_of_week.length === 0) return '—';
  // Sort Mon–Sat first, Sun last
  const sorted = [...s.days_of_week].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  const dayStr = sorted.map((d) => DAY_LABELS[d] ?? String(d)).join(' ');
  const timeStr =
    s.time_of_day_start && s.time_of_day_end
      ? ` · ${s.time_of_day_start}–${s.time_of_day_end}`
      : '';
  return dayStr + timeStr;
}

/* ------------------------------------------------------------------ *
 * Badges
 * ------------------------------------------------------------------ */

function PriorityBadge({ priority }: { priority: number }): JSX.Element {
  const high = priority >= 8;
  const mid = priority >= 5;
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '4px',
      fontSize: '0.72rem', fontWeight: 600,
      backgroundColor: high ? '#fee2e2' : mid ? '#fef9c3' : '#f3f4f6',
      color: high ? '#991b1b' : mid ? '#854d0e' : '#374151',
    }}>
      P{priority}
    </span>
  );
}

function PlaylistPill(): JSX.Element {
  return (
    <span style={{
      display: 'inline-block', marginLeft: '0.4rem',
      padding: '0.1rem 0.35rem', borderRadius: '3px',
      fontSize: '0.65rem', fontWeight: 600,
      backgroundColor: '#dbeafe', color: '#1e40af',
    }}>
      playlist
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Delete button (per row)
 * ------------------------------------------------------------------ */

function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }): JSX.Element {
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.delete<{ deleted: boolean }>(`/schedules/${id}`),
    onSuccess: onDeleted,
  });

  function handleClick(): void {
    if (!window.confirm('Delete this schedule? Screens will stop playing this content/playlist on their next sync.')) return;
    mutate();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{
        padding: '0.2rem 0.5rem', fontSize: '0.72rem', fontWeight: 600,
        color: isPending ? '#9ca3af' : '#dc2626',
        backgroundColor: isPending ? '#f9fafb' : '#fef2f2',
        border: `1px solid ${isPending ? '#e5e7eb' : '#fecaca'}`,
        borderRadius: '4px', cursor: isPending ? 'not-allowed' : 'pointer',
      }}
    >
      {isPending ? '…' : 'Delete'}
    </button>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const queryClient = useQueryClient();

  const { data: schedules, isLoading, isError, error } = useQuery<Schedule[]>({
    queryKey: ['schedules-all'],
    queryFn: () => api.get<Schedule[]>('/schedules'),
    staleTime: 15_000,
  });

  const count = schedules?.length ?? 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Schedules</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
            {isLoading
              ? 'Loading schedules…'
              : isError
              ? 'Schedules unavailable'
              : `${count} ${count === 1 ? 'schedule' : 'schedules'}`}
          </p>
        </div>
        <Link
          to="/schedules/new"
          style={{
            flexShrink: 0, display: 'inline-block',
            padding: '0.5rem 1rem',
            backgroundColor: '#1d4ed8', color: '#fff',
            borderRadius: '6px', textDecoration: 'none',
            fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          + New schedule
        </Link>
      </div>

      {/* Error */}
      {isError && (
        <div role="alert" style={{
          padding: '1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px',
          color: '#991b1b', fontSize: '0.875rem',
        }}>
          Failed to load schedules: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Loading */}
      {isLoading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading schedules…</p>}

      {/* Empty */}
      {!isLoading && !isError && count === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No schedules yet.</p>
      )}

      {/* Table */}
      {!isLoading && !isError && count > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>What</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Window</th>
                <th style={thStyle}>Daypart</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {schedules?.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {/* What */}
                  <td style={tdStyle}>
                    {s.playlist_name ? (
                      <span>
                        <span style={{ fontWeight: 500, color: '#111827' }}>{s.playlist_name}</span>
                        <PlaylistPill />
                      </span>
                    ) : s.content_id ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>
                        {s.content_id.slice(0, 8)}…
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>unknown</span>
                    )}
                  </td>
                  {/* Target */}
                  <td style={{ ...tdStyle, color: '#374151', fontSize: '0.8rem' }}>
                    {scheduleTarget(s)}
                  </td>
                  {/* Priority */}
                  <td style={tdStyle}>
                    <PriorityBadge priority={s.priority} />
                  </td>
                  {/* Window */}
                  <td style={{ ...tdStyle, color: '#374151', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {scheduleWindow(s)}
                  </td>
                  {/* Daypart */}
                  <td style={{ ...tdStyle, color: '#374151', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDaypart(s)}
                  </td>
                  {/* Delete */}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <DeleteButton
                      id={s.id}
                      onDeleted={() => void queryClient.invalidateQueries({ queryKey: ['schedules-all'] })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 600, color: '#374151',
  fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 0.75rem',
  verticalAlign: 'middle',
};
