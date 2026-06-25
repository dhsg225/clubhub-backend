/**
 * Venue Dashboard — screens and health data for a single venue.
 * Phase 2: real screen list with heartbeat fields from migrate_005.
 *
 * Data:
 *  - last_corpus_sync_at added in migrate_006 — used for the real 72h autonomy clock.
 *    last_seen_at is still shown as "Last Contact" (general heartbeat).
 *  - content_readiness_state is VARCHAR(20) set by the player heartbeat;
 *    RECOVERED_BUT_UNTRUSTED is a valid player-reported value, rendered as a
 *    distinct badge.
 */
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../lib/api-client.js';

interface Venue {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

interface Screen {
  id: string;
  venue_id: string;
  name: string | null;
  screen_group: string | null;
  last_seen_at: string | null;
  last_corpus_sync_at: string | null;
  created_at: string;
  assets_required_count: number | null;
  assets_verified_count: number | null;
  content_readiness_state: string | null;
  screen_layout: string | null;
}

/* ------------------------------------------------------------------ *
 * Layout types (fetched from GET /layouts)
 * ------------------------------------------------------------------ */

interface LayoutDefinition {
  grid_areas: string;
  grid_rows: string;
  grid_cols: string;
  playlist_zones: string[];
  widget_slots: { zone: string; position: string; width?: number; widget: string; corpus_key?: string }[];
}

interface LayoutRow {
  slug: string;
  display_name: string;
  definition: LayoutDefinition;
  is_system: boolean;
  sort_order: number;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Returns hours since last_seen_at, or null if unavailable. */
function hoursSinceContact(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

const AUTONOMY_WINDOW_HOURS = 72;

/* ------------------------------------------------------------------ *
 * Content readiness badge
 * ------------------------------------------------------------------ */

const READINESS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  READY:                   { bg: '#dcfce7', text: '#166534', label: 'READY' },
  PARTIAL:                 { bg: '#fef9c3', text: '#854d0e', label: 'PARTIAL' },
  MISSING:                 { bg: '#fee2e2', text: '#991b1b', label: 'MISSING' },
  RECOVERED_BUT_UNTRUSTED: { bg: '#ffedd5', text: '#9a3412', label: 'RECOVERED — UNTRUSTED' },
};

function ReadinessBadge({ state }: { state: string | null }): JSX.Element {
  if (!state) {
    return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>no data</span>;
  }
  const style = READINESS_STYLES[state] ?? { bg: '#f3f4f6', text: '#374151', label: state };
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
      fontSize: '0.72rem', fontWeight: 600, backgroundColor: style.bg, color: style.text,
    }}>
      {style.label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Asset ratio bar
 * ------------------------------------------------------------------ */

function AssetRatio({
  required,
  verified,
}: {
  required: number | null;
  verified: number | null;
}): JSX.Element {
  if (required === null || verified === null) {
    return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>unavailable</span>;
  }
  if (required === 0) {
    return <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>0 required</span>;
  }
  const pct = Math.min(100, Math.round((verified / required) * 100));
  const barColour = pct === 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{
        width: '64px', height: '6px', borderRadius: '3px',
        backgroundColor: '#e5e7eb', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColour }} />
      </div>
      <span style={{ fontSize: '0.78rem', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
        {verified}/{required}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Autonomy clock — driven by last_corpus_sync_at (migrate_006).
 * ------------------------------------------------------------------ */

function AutonomyClock({ lastCorpusSyncAt }: { lastCorpusSyncAt: string | null }): JSX.Element {
  const hours = hoursSinceContact(lastCorpusSyncAt);

  if (hours === null) {
    return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>unavailable</span>;
  }

  const remaining = AUTONOMY_WINDOW_HOURS - hours;
  const isOffline = hours > 1;
  const isWarning = remaining < 24 && remaining > 0;
  const isExpired = remaining <= 0;

  let colour = '#6b7280';
  if (isExpired) colour = '#991b1b';
  else if (isWarning) colour = '#854d0e';
  else if (isOffline) colour = '#9a3412';

  return (
    <div style={{ fontSize: '0.78rem', color: colour }}>
      <div>{formatRelativeTime(lastCorpusSyncAt)}</div>
      {isOffline && (
        <div style={{ marginTop: '0.1rem', fontSize: '0.7rem' }}>
          {isExpired
            ? `${Math.round(hours - AUTONOMY_WINDOW_HOURS)}h past 72h limit`
            : `${Math.round(remaining)}h of 72h remaining`}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen row
 * ------------------------------------------------------------------ */

function ScreenRow({
  screen,
  layoutSelection,
  onLayoutChange,
  layoutError,
  layouts,
}: {
  screen: Screen;
  layoutSelection: string;
  onLayoutChange: (screenId: string, value: string) => void;
  layoutError: string | null;
  layouts: LayoutRow[];
}): JSX.Element {
  const hours = hoursSinceContact(screen.last_corpus_sync_at);
  const isExpiredAutonomy = hours !== null && hours > AUTONOMY_WINDOW_HOURS;

  return (
    <tr style={{
      borderBottom: '1px solid #f3f4f6',
      backgroundColor: isExpiredAutonomy ? '#fef2f2' : undefined,
    }}>
      <td style={tdStyle}>
        <div style={{ fontWeight: 500, color: '#111827' }}>{screen.name ?? screen.id}</div>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.1rem', fontFamily: 'monospace' }}>{screen.id}</div>
        {screen.screen_group && (
          <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.15rem' }}>
            Group: {screen.screen_group}
          </div>
        )}
      </td>
      <td style={tdStyle}>
        <AutonomyClock lastCorpusSyncAt={screen.last_corpus_sync_at} />
      </td>
      <td style={tdStyle}>
        <ReadinessBadge state={screen.content_readiness_state} />
      </td>
      <td style={tdStyle}>
        <AssetRatio
          required={screen.assets_required_count}
          verified={screen.assets_verified_count}
        />
      </td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {layouts.map((layout) => {
            const selected = layoutSelection === layout.slug;
            return (
              <button
                key={layout.slug}
                type="button"
                title={layout.display_name}
                onClick={() => onLayoutChange(screen.id, layout.slug)}
                style={{
                  padding: '0.2rem', border: selected ? '2px solid #1d4ed8' : '1px solid #d1d5db',
                  borderRadius: '4px', cursor: 'pointer', backgroundColor: selected ? '#eff6ff' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
                }}
              >
                <MiniLayoutSvg definition={layout.definition} w={56} h={32} />
                <span style={{ fontSize: '0.58rem', color: selected ? '#1d4ed8' : '#6b7280', fontWeight: selected ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {layout.display_name}
                </span>
              </button>
            );
          })}
        </div>
        {layoutError && (
          <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: '#991b1b' }}>{layoutError}</div>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => window.open(`/preview/screen/${screen.id}`, '_blank', 'width=1280,height=720')}
          style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8', background: 'none', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', backgroundColor: '#eff6ff', whiteSpace: 'nowrap' }}
        >
          ▶
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Mini layout SVG — generated from grid_areas definition
 * ------------------------------------------------------------------ */

function MiniLayoutSvg({ definition, w, h }: { definition: LayoutDefinition; w: number; h: number }): JSX.Element {
  const gridRows = parseGridRows(definition.grid_areas);
  const rowCount = gridRows.length || 1;
  const colCount = gridRows[0]?.length || 1;
  const cellW = w / colCount;
  const cellH = h / rowCount;
  const rects = mergeZoneRects(gridRows, cellW, cellH);
  const pzSet = new Set(definition.playlist_zones);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect width={w} height={h} fill="#1e293b" rx={2} />
      {rects.map((r) => (
        <g key={r.name}>
          <rect x={r.x + 0.5} y={r.y + 0.5} width={r.w - 1} height={r.h - 1} rx={1}
            fill={pzSet.has(r.name) ? '#3b82f6' : '#10b981'} opacity={0.7} />
          {r.w > 14 && (
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="central"
              fill="#fff" fontSize={Math.min(7, r.w / Math.max(r.name.length, 1) * 1.2)} fontFamily="system-ui">
              {r.name.length > 6 ? r.name.slice(0, 5) + '…' : r.name}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function parseGridRows(gridAreas: string): string[][] {
  const rows: string[][] = [];
  const matches = gridAreas.match(/"([^"]+)"/g);
  if (!matches) return [['main']];
  for (const m of matches) rows.push(m.replace(/"/g, '').trim().split(/\s+/));
  return rows;
}

function mergeZoneRects(grid: string[][], cellW: number, cellH: number): { name: string; x: number; y: number; w: number; h: number }[] {
  const seen = new Map<string, { r1: number; c1: number; r2: number; c2: number }>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const name = grid[r]![c]!;
      const ex = seen.get(name);
      if (ex) { ex.r2 = Math.max(ex.r2, r); ex.c2 = Math.max(ex.c2, c); }
      else seen.set(name, { r1: r, c1: c, r2: r, c2: c });
    }
  }
  return [...seen.entries()].map(([name, b]) => ({
    name, x: b.c1 * cellW, y: b.r1 * cellH,
    w: (b.c2 - b.c1 + 1) * cellW, h: (b.r2 - b.r1 + 1) * cellH,
  }));
}

/* ------------------------------------------------------------------ *
 * Main component
 * ------------------------------------------------------------------ */

export function Component(): JSX.Element {
  const { venueId } = useParams<{ venueId: string }>();
  const queryClient = useQueryClient();

  // Optimistic layout selections keyed by screen id
  const [layoutSelections, setLayoutSelections] = useState<Record<string, string>>({});
  const [layoutErrors, setLayoutErrors] = useState<Record<string, string>>({});

  const { data: venue, isLoading: venueLoading, isError: venueError, error: venueErr } =
    useQuery<Venue>({
      queryKey: ['venue', venueId],
      queryFn: () => api.get<Venue>(`/venues/${venueId}`),
      enabled: !!venueId,
    });

  const { data: screens, isLoading: screensLoading, isError: screensError, error: screensErr } =
    useQuery<Screen[]>({
      queryKey: ['screens', venueId],
      queryFn: () => api.get<Screen[]>(`/screens?venue_id=${venueId}`),
      enabled: !!venueId,
    });

  // BL-048: fetch available layouts for the visual picker
  const { data: availableLayouts } = useQuery<LayoutRow[]>({
    queryKey: ['layouts'],
    queryFn: () => api.get<LayoutRow[]>('/layouts'),
    staleTime: 60_000,
  });
  const layouts = availableLayouts ?? [];

  const { mutate: patchLayout } = useMutation({
    mutationFn: ({ screenId, screen_layout }: { screenId: string; screen_layout: string }) =>
      api.patch<Screen>(`/screens/${screenId}`, { screen_layout }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['screens', venueId] }),
    onError: (err, variables) => {
      // Revert optimistic selection
      const screen = screens?.find((s) => s.id === variables.screenId);
      setLayoutSelections((prev) => ({
        ...prev,
        [variables.screenId]: screen?.screen_layout ?? 'fullscreen',
      }));
      setLayoutErrors((prev) => ({
        ...prev,
        [variables.screenId]: err instanceof Error ? err.message : 'Update failed',
      }));
    },
  });

  function handleLayoutChange(screenId: string, value: string): void {
    setLayoutSelections((prev) => ({ ...prev, [screenId]: value }));
    setLayoutErrors((prev) => ({ ...prev, [screenId]: '' }));
    patchLayout({ screenId, screen_layout: value });
  }

  if (venueLoading) {
    return (
      <div>
        <p style={{ color: '#6b7280' }}>Loading venue…</p>
      </div>
    );
  }

  if (venueError) {
    return (
      <div>
        <Link to="/" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
          ← Fleet Dashboard
        </Link>
        <div role="alert" style={{
          marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b',
        }}>
          Failed to load venue: {venueErr instanceof Error ? venueErr.message : String(venueErr)}
        </div>
      </div>
    );
  }

  const screenCount = screens?.length ?? 0;
  const recoveredUntrustedCount = screens?.filter(
    (s) => s.content_readiness_state === 'RECOVERED_BUT_UNTRUSTED',
  ).length ?? 0;
  const expiredAutonomyCount = screens?.filter((s) => {
    const h = hoursSinceContact(s.last_corpus_sync_at);
    return h !== null && h > AUTONOMY_WINDOW_HOURS;
  }).length ?? 0;

  return (
    <div>
      <Link to="/" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
        ← Fleet Dashboard
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', margin: '0.75rem 0 1.5rem', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>
            {venue?.name ?? venueId}
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {venue?.timezone} · ID: {venue?.id}
          </p>
        </div>

        {/* Summary chips — only shown when screens loaded */}
        {!screensLoading && !screensError && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <SummaryChip label={`${screenCount} location${screenCount !== 1 ? 's' : ''}`} colour="#6b7280" />
            {recoveredUntrustedCount > 0 && (
              <SummaryChip label={`${recoveredUntrustedCount} RECOVERED_BUT_UNTRUSTED`} colour="#9a3412" />
            )}
            {expiredAutonomyCount > 0 && (
              <SummaryChip label={`${expiredAutonomyCount} past 72h`} colour="#991b1b" />
            )}
          </div>
        )}
      </div>

      {/* Screens section */}
      <section>
        <h2 style={sectionHeading}>Locations</h2>

        {screensLoading && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading locations…</p>
        )}

        {screensError && (
          <div role="alert" style={{
            padding: '0.875rem 1rem', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.875rem',
          }}>
            Failed to load locations: {screensErr instanceof Error ? screensErr.message : String(screensErr)}
          </div>
        )}

        {!screensLoading && !screensError && screenCount === 0 && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No locations enrolled for this venue.</p>
        )}

        {!screensLoading && !screensError && screenCount > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thStyle}>Location</th>
                  <th style={thStyle}>72h Autonomy Clock</th>
                  <th style={thStyle}>Content Readiness</th>
                  <th style={thStyle}>Assets (verified/required)</th>
                  <th style={thStyle}>Layout</th>
                  <th style={{ ...thStyle, width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {screens?.map((screen) => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    layoutSelection={layoutSelections[screen.id] ?? screen.screen_layout ?? 'fullscreen'}
                    onLayoutChange={handleLayoutChange}
                    layoutError={layoutErrors[screen.id] ?? null}
                    layouts={layouts}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small shared primitives
 * ------------------------------------------------------------------ */

function SummaryChip({ label, colour }: { label: string; colour: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600, backgroundColor: `${colour}18`, color: colour,
      border: `1px solid ${colour}40`,
    }}>
      {label}
    </span>
  );
}

const sectionHeading: React.CSSProperties = {
  margin: '0 0 0.875rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

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
