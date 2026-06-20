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
  layout_template: string | null;
}

/* ------------------------------------------------------------------ *
 * Layout constants
 * ------------------------------------------------------------------ */

const LAYOUT_OPTIONS = ['fullscreen', 'split_horizontal', 'news_bar', 'quad'] as const;

const LAYOUT_LABELS: Record<string, string> = {
  fullscreen:       'Full Screen',
  split_horizontal: 'Split Horizontal',
  news_bar:         'News Bar',
  quad:             'Quad',
};

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
}: {
  screen: Screen;
  layoutSelection: string;
  onLayoutChange: (screenId: string, value: string) => void;
  layoutError: string | null;
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
        {screen.name && (
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.1rem' }}>{screen.id}</div>
        )}
        {screen.screen_group && (
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.1rem' }}>
            {screen.screen_group}
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
        <select
          value={layoutSelection}
          onChange={(e) => onLayoutChange(screen.id, e.target.value)}
          style={{
            fontSize: '0.8rem', padding: '0.2rem 0.4rem',
            border: '1px solid #d1d5db', borderRadius: '4px',
            color: '#111827', backgroundColor: '#fff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {LAYOUT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{LAYOUT_LABELS[opt]}</option>
          ))}
        </select>
        {layoutError && (
          <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: '#991b1b' }}>{layoutError}</div>
        )}
      </td>
    </tr>
  );
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

  const { mutate: patchLayout } = useMutation({
    mutationFn: ({ screenId, layout_template }: { screenId: string; layout_template: string }) =>
      api.patch<Screen>(`/screens/${screenId}`, { layout_template }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['screens', venueId] }),
    onError: (err, variables) => {
      // Revert optimistic selection
      const screen = screens?.find((s) => s.id === variables.screenId);
      setLayoutSelections((prev) => ({
        ...prev,
        [variables.screenId]: screen?.layout_template ?? 'fullscreen',
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
    patchLayout({ screenId, layout_template: value });
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
            <SummaryChip label={`${screenCount} screen${screenCount !== 1 ? 's' : ''}`} colour="#6b7280" />
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
        <h2 style={sectionHeading}>Screens</h2>

        {screensLoading && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading screens…</p>
        )}

        {screensError && (
          <div role="alert" style={{
            padding: '0.875rem 1rem', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.875rem',
          }}>
            Failed to load screens: {screensErr instanceof Error ? screensErr.message : String(screensErr)}
          </div>
        )}

        {!screensLoading && !screensError && screenCount === 0 && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No screens enrolled for this venue.</p>
        )}

        {!screensLoading && !screensError && screenCount > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thStyle}>Screen</th>
                  <th style={thStyle}>72h Autonomy Clock</th>
                  <th style={thStyle}>Content Readiness</th>
                  <th style={thStyle}>Assets (verified/required)</th>
                  <th style={thStyle}>Layout</th>
                </tr>
              </thead>
              <tbody>
                {screens?.map((screen) => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    layoutSelection={layoutSelections[screen.id] ?? screen.layout_template ?? 'fullscreen'}
                    onLayoutChange={handleLayoutChange}
                    layoutError={layoutErrors[screen.id] ?? null}
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
