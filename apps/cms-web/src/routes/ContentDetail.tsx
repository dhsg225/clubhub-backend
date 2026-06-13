/**
 * Content Detail — single content/campaign item.
 * Route: `/content/:id`. Linked from CampaignList rows.
 *
 * Data shape (GET /content/:id):
 *   { id, template_type, data (JSONB), created_at }
 * No `status` field on the single-item endpoint.
 * The `data` field is arbitrary JSONB — all key/value pairs are rendered.
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client.js';

interface ContentItem {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface Schedule {
  id: string;
  content_id: string;
  venue_id: string | null;
  screen_id: string | null;
  screen_group: string | null;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function deriveTitle(item: ContentItem): string {
  const d = item.data ?? {};
  if (typeof d.title === 'string' && d.title.trim()) return d.title;
  if (typeof d.name === 'string' && d.name.trim()) return d.name;
  return item.template_type;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Render an unknown JSONB value as a readable string. */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '(empty string)';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

/** True if the value is an object/array that deserves block rendering. */
function isComplex(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ *
 * Schedule target label
 * ------------------------------------------------------------------ */

function scheduleTarget(s: Schedule): string {
  if (s.screen_id) return `Screen: ${s.screen_id}`;
  if (s.screen_group) return `Group: ${s.screen_group}`;
  if (s.venue_id) return `Venue: ${s.venue_id}`;
  return 'Global';
}

/* ------------------------------------------------------------------ *
 * Priority badge
 * ------------------------------------------------------------------ */

function PriorityBadge({ priority }: { priority: number }): JSX.Element {
  const high = priority >= 8;
  const mid = priority >= 5;
  const bg = high ? '#fee2e2' : mid ? '#fef9c3' : '#f3f4f6';
  const text = high ? '#991b1b' : mid ? '#854d0e' : '#374151';
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '4px',
      fontSize: '0.72rem', fontWeight: 600, backgroundColor: bg, color: text,
    }}>
      P{priority}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Schedules panel
 * ------------------------------------------------------------------ */

function SchedulesPanel({ contentId }: { contentId: string }): JSX.Element {
  const { data: schedules, isLoading, isError, error } = useQuery<Schedule[]>({
    queryKey: ['schedules', contentId],
    queryFn: () => api.get<Schedule[]>(`/schedules?content_id=${contentId}`),
  });

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2 style={sectionHeading}>Schedules</h2>

      {isLoading && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading schedules…</p>
      )}

      {isError && (
        <div role="alert" style={{
          padding: '0.75rem 1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px',
          color: '#991b1b', fontSize: '0.875rem',
        }}>
          Failed to load schedules: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {!isLoading && !isError && (schedules?.length ?? 0) === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No schedules — this content is not playing anywhere.
        </p>
      )}

      {!isLoading && !isError && (schedules?.length ?? 0) > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>Window</th>
            </tr>
          </thead>
          <tbody>
            {schedules!.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ ...tdStyle, color: '#374151' }}>{scheduleTarget(s)}</td>
                <td style={tdStyle}><PriorityBadge priority={s.priority} /></td>
                <td style={{ ...tdStyle, color: '#374151' }}>
                  {s.starts_at === null && s.ends_at === null
                    ? <span style={{ color: '#6b7280' }}>always</span>
                    : `${formatDateShort(s.starts_at)} → ${formatDateShort(s.ends_at)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Data field table — renders all JSONB key/value pairs
 * ------------------------------------------------------------------ */

function DataFields({ data }: { data: Record<string, unknown> | null }): JSX.Element {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.875rem' }}>
        No data fields present.
      </p>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
          <th style={thStyle}>Field</th>
          <th style={thStyle}>Value</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(data).map(([key, value]) => (
          <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ ...tdStyle, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' }}>
              {key}
            </td>
            <td style={{ ...tdStyle, color: '#111827' }}>
              {isComplex(value) ? (
                <pre style={{
                  margin: 0, fontSize: '0.78rem', color: '#374151',
                  backgroundColor: '#f9fafb', padding: '0.4rem 0.6rem',
                  borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {renderValue(value)}
                </pre>
              ) : (
                renderValue(value)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  const { data: item, isLoading, isError, error } = useQuery<ContentItem>({
    queryKey: ['content', id],
    queryFn: () => api.get<ContentItem>(`/content/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Link to="/campaigns" style={backLinkStyle}>← Campaigns</Link>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading content…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Link to="/campaigns" style={backLinkStyle}>← Campaigns</Link>
        <div role="alert" style={{
          marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px',
          color: '#991b1b', fontSize: '0.875rem',
        }}>
          Failed to load content: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Link to="/campaigns" style={backLinkStyle}>← Campaigns</Link>
        <p style={{ color: '#9ca3af', fontStyle: 'italic', marginTop: '1rem' }}>
          Content item not found.
        </p>
      </div>
    );
  }

  const title = deriveTitle(item);
  const titleIsFallback = !(
    (typeof item.data?.title === 'string' && item.data.title.trim()) ||
    (typeof item.data?.name === 'string' && item.data.name.trim())
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '800px' }}>
      <Link to="/campaigns" style={backLinkStyle}>← Campaigns</Link>

      {/* Header */}
      <div style={{ margin: '0.75rem 0 1.5rem' }}>
        <h1 style={{
          margin: '0 0 0.25rem',
          fontSize: '1.5rem', fontWeight: 600,
          fontStyle: titleIsFallback ? 'italic' : 'normal',
        }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          {item.template_type}
          {titleIsFallback && (
            <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>
              · no title in data — showing template type
            </span>
          )}
        </p>
      </div>

      {/* Meta row */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={sectionHeading}>Details</h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'max-content 1fr',
          gap: '0.35rem 1.5rem', fontSize: '0.875rem',
        }}>
          <span style={{ color: '#6b7280' }}>ID</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>{item.id}</span>
          <span style={{ color: '#6b7280' }}>Template type</span>
          <span>{item.template_type}</span>
          <span style={{ color: '#6b7280' }}>Created</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
      </section>

      {/* Data fields */}
      <section style={{ marginBottom: '0' }}>
        <h2 style={sectionHeading}>Content Data</h2>
        <DataFields data={item.data} />
      </section>

      {/* Schedules */}
      <SchedulesPanel contentId={item.id} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Style constants
 * ------------------------------------------------------------------ */

const backLinkStyle: React.CSSProperties = {
  fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none',
};

const sectionHeading: React.CSSProperties = {
  margin: '0 0 0.875rem',
  fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 600, color: '#374151',
  fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  verticalAlign: 'top',
};
