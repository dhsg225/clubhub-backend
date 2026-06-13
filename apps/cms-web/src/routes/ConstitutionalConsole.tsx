/**
 * Constitutional Console — PLATFORM_ADMIN only.
 * Read-only view: current constitutional state from the Zustand store
 * (updated live via WebSocketConstitutionalSync) plus the raw /health
 * response from the CMS API backend.
 */
import { useQuery } from '@tanstack/react-query';
import { useConstitutionalStore } from '../stores/constitutionalStore.js';
import { api } from '../lib/api-client.js';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

interface HealthResponse {
  status: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatTimestamp(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const STATE_COLOURS: Record<string, { bg: string; text: string }> = {
  HEALTHY:          { bg: '#dcfce7', text: '#166534' },
  READ_ONLY:        { bg: '#fef9c3', text: '#854d0e' },
  DEGRADED:         { bg: '#ffedd5', text: '#9a3412' },
  EMERGENCY_FREEZE: { bg: '#fee2e2', text: '#991b1b' },
};

function ConstitutionalStateBadge({ state }: { state: string }): JSX.Element {
  const colours = STATE_COLOURS[state] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.3rem 0.75rem', borderRadius: '4px',
      fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.03em',
      backgroundColor: colours.bg, color: colours.text,
    }}>
      {state}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Health JSON display
 * ------------------------------------------------------------------ */

function HealthTable({ data }: { data: HealthResponse }): JSX.Element {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
          <th style={thStyle}>Key</th>
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
              {typeof value === 'object' && value !== null ? (
                <pre style={{
                  margin: 0, fontSize: '0.78rem', color: '#374151',
                  backgroundColor: '#f9fafb', padding: '0.4rem 0.6rem',
                  borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                String(value ?? '—')
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
  const { state, reason, lastUpdated } = useConstitutionalStore();

  const { data: health, isLoading: healthLoading, isError: healthError, error: healthErr } =
    useQuery<HealthResponse>({
      queryKey: ['health'],
      queryFn: () => api.get<HealthResponse>('/health'),
      staleTime: 15_000,
      refetchInterval: 30_000,
    });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '800px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>
          Constitutional Console
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          Read-only — PLATFORM_ADMIN only
        </p>
      </div>

      {/* Constitutional state */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={sectionHeading}>Constitutional State</h2>
        <div style={{
          border: '1px solid #e5e7eb', borderRadius: '8px',
          padding: '1rem 1.25rem', backgroundColor: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <ConstitutionalStateBadge state={state} />
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'max-content 1fr',
            gap: '0.35rem 1.5rem', fontSize: '0.875rem',
          }}>
            <span style={{ color: '#6b7280' }}>Reason</span>
            <span style={{ fontStyle: reason ? 'normal' : 'italic', color: reason ? '#111827' : '#9ca3af' }}>
              {reason ?? 'none reported'}
            </span>
            <span style={{ color: '#6b7280' }}>Last updated</span>
            <span style={{ color: '#374151' }}>{formatTimestamp(lastUpdated)}</span>
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
            State is pushed via WebSocket from the CMS API. This view reflects the last received message.
          </p>
        </div>
      </section>

      {/* Backend health */}
      <section>
        <h2 style={sectionHeading}>Backend Health (GET /health)</h2>

        {healthLoading && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading health data…</p>
        )}

        {healthError && (
          <div role="alert" style={{
            padding: '0.875rem 1rem', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '6px',
            color: '#991b1b', fontSize: '0.875rem',
          }}>
            Health endpoint unavailable:{' '}
            {healthErr instanceof Error ? healthErr.message : String(healthErr)}
          </div>
        )}

        {!healthLoading && !healthError && health && (
          <HealthTable data={health} />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Style constants
 * ------------------------------------------------------------------ */

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
