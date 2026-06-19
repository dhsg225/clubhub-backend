/**
 * Playlist List — all named playlists.
 * Route: /playlists
 *
 * Data: GET /named_playlists → [{ id, name, ordering_rule, card_count, created_at, updated_at }]
 * Visual style matches CampaignList.tsx (badge/table idiom, system-ui font, inline styles).
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client.js';

interface NamedPlaylist {
  id: string;
  name: string;
  ordering_rule: string;
  card_count: number;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function OrderBadge({ rule }: { rule: string }): JSX.Element {
  const label = rule === 'shuffle' ? 'Shuffle' : 'Sequential';
  const bg = rule === 'shuffle' ? '#dbeafe' : '#f3f4f6';
  const text = rule === 'shuffle' ? '#1e40af' : '#374151';
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
      fontSize: '0.72rem', fontWeight: 600, backgroundColor: bg, color: text,
    }}>
      {label}
    </span>
  );
}

export function Component(): JSX.Element {
  const { data: playlists, isLoading, isError, error } = useQuery<NamedPlaylist[]>({
    queryKey: ['named-playlists'],
    queryFn: () => api.get<NamedPlaylist[]>('/named_playlists'),
    staleTime: 15_000,
  });

  const count = playlists?.length ?? 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Playlists</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
            {isLoading
              ? 'Loading playlists…'
              : isError
              ? 'Playlist list unavailable'
              : `${count} ${count === 1 ? 'playlist' : 'playlists'}`}
          </p>
        </div>
        <Link
          to="/playlists/new"
          style={{
            flexShrink: 0, display: 'inline-block',
            padding: '0.5rem 1rem',
            backgroundColor: '#1d4ed8', color: '#fff',
            borderRadius: '6px', textDecoration: 'none',
            fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          + New playlist
        </Link>
      </div>

      {/* Error */}
      {isError && (
        <div role="alert" style={{
          padding: '1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px',
          color: '#991b1b', fontSize: '0.875rem',
        }}>
          Failed to load playlists: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading playlists…</p>
      )}

      {/* Empty */}
      {!isLoading && !isError && count === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          No playlists yet — create one to group cards into a loop.
        </p>
      )}

      {/* Table */}
      {!isLoading && !isError && count > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Cards</th>
                <th style={thStyle}>Order</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {playlists?.map((pl) => (
                <tr key={pl.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{pl.name}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '0.15rem 0.45rem', borderRadius: '4px',
                      fontSize: '0.72rem', fontWeight: 600,
                      backgroundColor: '#f3f4f6', color: '#374151',
                    }}>
                      {pl.card_count} {Number(pl.card_count) === 1 ? 'card' : 'cards'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <OrderBadge rule={pl.ordering_rule} />
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>
                    {formatDate(pl.created_at)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <Link
                      to={`/playlists/${pl.id}`}
                      style={{ color: '#1d4ed8', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Edit →
                    </Link>
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

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 600, color: '#374151',
  fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 0.75rem',
  verticalAlign: 'middle',
};
