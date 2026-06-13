/**
 * Audit Log — recent operator and system audit events from audit-service.
 * Route: `/audit`. Visible to AUDITOR, ENTERPRISE_ADMIN, PLATFORM_ADMIN
 * (nav link already gated in AppLayout).
 *
 * Data source: audit-service at localhost:3002, proxied via Vite at /api/audit.
 * Does NOT use the api client (which targets /api/v1 → :4000).
 * Fetches directly: GET /api/audit/audit/events?limit=100
 *
 * Response shape:
 *   { events: AuditEvent[]; count: number; at_utc_ms: number }
 */
import { useQuery } from '@tanstack/react-query';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

interface AuditEvent {
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  screen_id: string | null;
  venue_id: string | null;
  recorded_at: string;
}

interface AuditEventsResponse {
  events: AuditEvent[];
  count: number;
  at_utc_ms: number;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function payloadSummary(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return json.length > 80 ? json.slice(0, 77) + '…' : json;
}

/* ------------------------------------------------------------------ *
 * Event type badge
 * ------------------------------------------------------------------ */

const EVENT_TYPE_COLOURS: Record<string, { bg: string; text: string }> = {
  CONTENT_PUBLISHED:    { bg: '#dcfce7', text: '#166534' },
  CONTENT_UPDATED:      { bg: '#dbeafe', text: '#1e40af' },
  SCHEDULE_CREATED:     { bg: '#dbeafe', text: '#1e40af' },
  SCREEN_ENROLLED:      { bg: '#f0fdf4', text: '#15803d' },
  INCIDENT_OPENED:      { bg: '#fee2e2', text: '#991b1b' },
  INCIDENT_CLOSED:      { bg: '#dcfce7', text: '#166534' },
  OTA_STARTED:          { bg: '#fef9c3', text: '#854d0e' },
  OTA_COMPLETED:        { bg: '#dcfce7', text: '#166534' },
  OTA_FAILED:           { bg: '#fee2e2', text: '#991b1b' },
  CONSTITUTIONAL_STATE: { bg: '#ffedd5', text: '#9a3412' },
};

function EventTypeBadge({ type }: { type: string }): JSX.Element {
  const colours = EVENT_TYPE_COLOURS[type] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '4px',
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.02em',
      backgroundColor: colours.bg, color: colours.text,
      fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

function UnavailableNote(): JSX.Element {
  return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>;
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const { data, isLoading, isError, error } = useQuery<AuditEventsResponse>({
    queryKey: ['audit-events'],
    queryFn: () => fetch('/api/audit/audit/events?limit=100').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<AuditEventsResponse>;
    }),
    refetchInterval: 30_000,
  });

  const events = data?.events ?? [];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Audit Log</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
          {isLoading
            ? 'Loading events…'
            : isError
            ? 'Audit log unavailable'
            : `${data?.count ?? events.length} event${(data?.count ?? events.length) !== 1 ? 's' : ''}${data?.at_utc_ms ? ` · as of ${formatTimestamp(new Date(data.at_utc_ms).toISOString())}` : ''}`}
        </p>
      </div>

      {/* Error */}
      {isError && (
        <div role="alert" style={{
          padding: '1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px',
          color: '#991b1b', fontSize: '0.875rem',
        }}>
          Failed to load audit events: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading audit events…</p>
      )}

      {/* Empty */}
      {!isLoading && !isError && events.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No audit events recorded yet.</p>
      )}

      {/* Table */}
      {!isLoading && !isError && events.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Recorded At</th>
                <th style={thStyle}>Event Type</th>
                <th style={thStyle}>Venue</th>
                <th style={thStyle}>Screen</th>
                <th style={thStyle}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.event_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#374151' }}>
                    {formatTimestamp(ev.recorded_at)}
                  </td>
                  <td style={tdStyle}>
                    <EventTypeBadge type={ev.event_type} />
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>
                    {ev.venue_id ?? <UnavailableNote />}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>
                    {ev.screen_id ?? <UnavailableNote />}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.75rem', color: '#374151',
                      display: 'block', maxWidth: '320px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={JSON.stringify(ev.payload)}>
                      {payloadSummary(ev.payload)}
                    </span>
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

/* ------------------------------------------------------------------ *
 * Style constants
 * ------------------------------------------------------------------ */

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 600, color: '#374151',
  fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  verticalAlign: 'top',
};
