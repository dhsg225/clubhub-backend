/**
 * Fleet Dashboard — top-level overview of all venues.
 * Fetches venue list from the CMS API and renders each as a row with
 * name, timezone, and constitutional state indicator.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client.js';
import { useConstitutionalState } from '../stores/constitutionalStore.js';

interface Venue {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

function ConstitutionalBadge({ state }: { state: string }): JSX.Element {
  const colours: Record<string, { bg: string; text: string }> = {
    HEALTHY:          { bg: '#dcfce7', text: '#166534' },
    READ_ONLY:        { bg: '#fef9c3', text: '#854d0e' },
    EMERGENCY_FREEZE: { bg: '#fee2e2', text: '#991b1b' },
    DEGRADED:         { bg: '#ffedd5', text: '#9a3412' },
  };
  const style = colours[state] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: style.bg,
      color: style.text,
    }}>
      {state}
    </span>
  );
}

export function Component(): JSX.Element {
  const { state: constitutionalState } = useConstitutionalState();

  const { data: venues, isLoading, isError, error } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => api.get<Venue[]>('/venues'),
  });

  if (isLoading) {
    return (
      <div>
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Fleet Dashboard</h1>
        <p style={{ color: '#6b7280' }}>Loading venues…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Fleet Dashboard</h1>
        <div role="alert" style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#991b1b',
        }}>
          Failed to load venues: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Fleet Dashboard</h1>
        <ConstitutionalBadge state={constitutionalState} />
      </div>

      {venues?.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No venues found. Create one via the CMS API.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>Venue</th>
              <th style={thStyle}>Timezone</th>
              <th style={thStyle}>Constitutional State</th>
              <th style={thStyle}>Created</th>
            </tr>
          </thead>
          <tbody>
            {venues?.map((venue) => (
              <tr key={venue.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <Link
                    to={`/venues/${venue.id}`}
                    style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {venue.name}
                  </Link>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>{venue.id}</div>
                </td>
                <td style={tdStyle}>{venue.timezone}</td>
                <td style={tdStyle}>
                  {/* Constitutional state is platform-wide in Phase 1 — per-venue state requires future health API */}
                  <ConstitutionalBadge state={constitutionalState} />
                </td>
                <td style={tdStyle}>
                  {new Date(venue.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.75rem',
  fontWeight: 600,
  color: '#374151',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem',
  verticalAlign: 'top',
};
