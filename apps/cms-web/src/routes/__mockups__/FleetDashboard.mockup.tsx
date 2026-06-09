/**
 * FleetDashboard — Live Operations Surface (fleet scope, route `/fleet`).
 *
 * Extends the original fleet venue list into the full three-zone Live Operations
 * Surface described in LIVE-OPERATIONS-WIREFRAMES-v1.md (primarily WF-LO-06):
 *
 *   ┌ System Status Bar (48px, z 1000) ─────────────────────────────────────┐
 *   │ Zone A (280px nav) │ Zone B (fluid — Fleet Overview) │ Zone C (320/48) │
 *   └ Audit Trace Footer (28px, z 1000) ────────────────────────────────────┘
 *
 * Design constraints honoured:
 *  - TypeScript / React 18, inline styles only, no component library, no new deps.
 *  - Reuses the existing `useQuery(['venues'])` data path and the
 *    `ConstitutionalBadge` / `useConstitutionalState` patterns (extended below).
 *
 * Authority model:
 *  The wireframes gate controls on a VIEWER / OPERATOR / ADMIN / Incident-Commander
 *  authority model. The available `authStore` exposes a different role enum and no
 *  IC / elevation signal, so the VIEWER/IC boundary is undefined here. Every
 *  role-gated affordance therefore renders an `<AuthorityPlaceholder>` tagged with
 *  `// TODO: A-07 — authority boundary undefined` instead of a fabricated mapping.
 *
 *  Per-venue operational telemetry (player state, PRE level, heartbeat, overrides)
 *  is a *data* gap, not an authority gap — it is rendered as an honest
 *  "unavailable" state per the spec's anti-false-positive principle (FP-06),
 *  pending the venue health API.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client.js';
import { useConstitutionalState } from '../../stores/constitutionalStore.js';
import { useAuthStore } from '../../stores/authStore.js';

interface Venue {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Constitutional-state visual treatments
 * Driven entirely by the platform constitutional state, which IS
 * available from the store. Maps each state to its surface treatment.
 * ------------------------------------------------------------------ */

interface StateTreatment {
  /** Active-mode indicator text in the status bar. */
  mode: string;
  /** Zone A left-border (peripheral alarm signal). */
  zoneABorder: string;
  /** Status-bar background + text colour. */
  barBackground: string;
  barText: string;
  /** EMERGENCY_FREEZE locks Zone C, raises the interrupt banner, etc. */
  freeze: boolean;
  /** Light tint applied to Zone C during freeze. */
  zoneCTint: string;
}

const STATE_TREATMENTS: Record<string, StateTreatment> = {
  HEALTHY: {
    mode: 'LIVE', zoneABorder: 'none', barBackground: '#ffffff',
    barText: '#111827', freeze: false, zoneCTint: 'transparent',
  },
  DEGRADED: {
    mode: 'LIVE', zoneABorder: '2px solid #f59e0b', barBackground: '#ffffff',
    barText: '#111827', freeze: false, zoneCTint: 'transparent',
  },
  CONSTITUTIONAL_RISK: {
    mode: 'INCIDENT ACTIVE', zoneABorder: '4px solid #f97316', barBackground: '#ffffff',
    barText: '#111827', freeze: false, zoneCTint: 'transparent',
  },
  SHADOW_ONLY: {
    mode: 'LIVE', zoneABorder: '4px solid #f97316', barBackground: '#ffffff',
    barText: '#111827', freeze: false, zoneCTint: 'transparent',
  },
  PRE_DISABLED: {
    mode: 'LIVE', zoneABorder: '4px solid #f97316', barBackground: '#ffffff',
    barText: '#111827', freeze: false, zoneCTint: 'transparent',
  },
  READ_ONLY: {
    mode: 'LIVE', zoneABorder: '4px solid #f97316', barBackground: '#ffffff',
    barText: '#111827', freeze: false, zoneCTint: 'transparent',
  },
  EMERGENCY_FREEZE: {
    mode: 'EMERGENCY FREEZE', zoneABorder: '4px solid #dc2626', barBackground: '#991b1b',
    barText: '#ffffff', freeze: true, zoneCTint: '#fef2f2',
  },
};

const DEFAULT_TREATMENT: StateTreatment = {
  mode: 'LIVE', zoneABorder: 'none', barBackground: '#ffffff',
  barText: '#111827', freeze: false, zoneCTint: 'transparent',
};

function treatmentFor(state: string): StateTreatment {
  return STATE_TREATMENTS[state] ?? DEFAULT_TREATMENT;
}

/* ------------------------------------------------------------------ *
 * ConstitutionalBadge — extended from the original.
 * Original mapping preserved; adds an optional confidence dot per the
 * ConstitutionalStateIndicator rules (CG-06: confidence must always be
 * presented alongside the state value).
 * ------------------------------------------------------------------ */

const BADGE_COLOURS: Record<string, { bg: string; text: string }> = {
  HEALTHY:             { bg: '#dcfce7', text: '#166534' },
  DEGRADED:            { bg: '#fef9c3', text: '#854d0e' },
  CONSTITUTIONAL_RISK: { bg: '#ffedd5', text: '#9a3412' },
  SHADOW_ONLY:         { bg: '#ffedd5', text: '#9a3412' },
  PRE_DISABLED:        { bg: '#ffedd5', text: '#9a3412' },
  READ_ONLY:           { bg: '#fef9c3', text: '#854d0e' },
  EMERGENCY_FREEZE:    { bg: '#fee2e2', text: '#991b1b' },
};

function ConstitutionalBadge({
  state,
  confidence,
  invert,
}: {
  state: string;
  confidence?: string;
  invert?: boolean;
}): JSX.Element {
  const palette = BADGE_COLOURS[state] ?? { bg: '#f3f4f6', text: '#374151' };
  const style: React.CSSProperties = invert
    ? { backgroundColor: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.6)' }
    : { backgroundColor: palette.bg, color: palette.text };
  // confidence is not yet provided by the store — render the slot honestly
  // (CG-06) rather than implying HIGH confidence by omission.
  const confLabel = confidence ?? 'confidence —';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <span
        style={{
          display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
          fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em', ...style,
        }}
      >
        {state}
      </span>
      <span
        style={{ fontSize: '0.7rem', color: invert ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}
        title="Confidence level is not yet supplied by the constitutional state feed."
      >
        {confLabel}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Small shared primitives
 * ------------------------------------------------------------------ */

function StatusDot({ colour, title }: { colour: string; title?: string }): JSX.Element {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block', width: '0.6rem', height: '0.6rem',
        borderRadius: '50%', backgroundColor: colour, flexShrink: 0,
      }}
    />
  );
}

/** Renders where the wireframe needs the (undefined) VIEWER/IC authority boundary. */
function AuthorityPlaceholder({ label }: { label: string }): JSX.Element {
  return (
    <div
      role="note"
      style={{
        border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.625rem',
        backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.72rem', lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 600, color: '#475569' }}>{label}</div>
      <div style={{ marginTop: '0.15rem' }}>
        Authority boundary undefined (A-07) — role gating unavailable.
      </div>
    </div>
  );
}

/** Muted "data not yet available" note — used for telemetry gaps (FP-06). */
function UnavailableNote({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>{children}</span>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const { state: constitutionalState } = useConstitutionalState();
  const { role } = useAuthStore();
  const treatment = treatmentFor(constitutionalState);

  const { data: venues, isLoading, isError, error } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => api.get<Venue[]>('/venues'),
  });

  // Governed wall clock. The spec mandates a server-driven `session_start`
  // clock; that signal is not yet wired, so we tick locally for now.
  // TODO: drive from the session provider's governed clock, not Date.now().
  const [clock, setClock] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour12: false }),
  );
  useEffect(() => {
    const id = setInterval(
      () => setClock(new Date().toLocaleTimeString([], { hour12: false })),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  // Zone C state ----------------------------------------------------
  type ZoneCTab = 'context' | 'health' | 'activity' | 'advisory';
  const [zoneCTab, setZoneCTab] = useState<ZoneCTab>('context');
  const ZONE_C_KEY = 'zone_c_state'; // TODO: key by operator_id once session identity is exposed.
  const [zoneCCollapsed, setZoneCCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ZONE_C_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(ZONE_C_KEY, zoneCCollapsed ? 'collapsed' : 'expanded');
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }, [zoneCCollapsed]);
  // EMERGENCY_FREEZE auto-activates the Constitutional Advisory pane (C4) and
  // locks Zone C expanded.
  useEffect(() => {
    if (treatment.freeze) {
      setZoneCTab('advisory');
    }
  }, [treatment.freeze]);
  const zoneCExpanded = treatment.freeze ? true : !zoneCCollapsed;

  const venueCount = venues?.length ?? 0;

  /* ---------------------------------------------------------------- *
   * Surface root — fixed full-viewport so the SystemStatusBar and
   * AuditTraceFooter honour their always-visible z-index contracts
   * regardless of the host shell's padding.
   * ---------------------------------------------------------------- */
  const surfaceRoot: React.CSSProperties = {
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    backgroundColor: '#ffffff', color: '#111827',
    fontFamily: 'system-ui, sans-serif', fontSize: '0.875rem', zIndex: 0,
  };

  return (
    <div style={surfaceRoot}>
      {/* ===================== SYSTEM STATUS BAR (48px, z 1000) ===================== */}
      <header
        role="banner"
        style={{
          height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: '1.25rem', padding: '0 1rem', zIndex: 1000,
          backgroundColor: treatment.barBackground, color: treatment.barText,
          borderBottom: treatment.freeze ? 'none' : '1px solid #e5e7eb',
        }}
      >
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center' }}>
          <ConstitutionalBadge state={constitutionalState} invert={treatment.freeze} />
        </div>
        <span
          aria-live="polite"
          style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}
        >
          {treatment.mode}
        </span>
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          Wall: {clock}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
          Operator · {String(role ?? '—')}
        </span>
        {/* Elevate Session — presence depends on the VIEWER boundary (absent for
            VIEWER, present for OPERATOR/ADMIN). That boundary is undefined. */}
        {/* TODO: A-07 — authority boundary undefined */}
        <div style={{ width: '150px' }}>
          <AuthorityPlaceholder label="Elevate Session" />
        </div>
        <span aria-label="Unread notifications" title="Notification count feed not yet wired">
          🔔 <UnavailableNote>—</UnavailableNote>
        </span>
      </header>

      {/* ===================== INTERRUPT DISPLAY (EMERGENCY_FREEZE) ===================== */}
      {treatment.freeze && (
        <div
          role="alert"
          style={{
            flexShrink: 0, backgroundColor: '#dc2626', color: '#ffffff', zIndex: 900,
            padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4,
          }}
        >
          EMERGENCY FREEZE ACTIVE — All content changes are halted. Emergency content
          management is the only permitted write action.
        </div>
      )}

      {/* ===================== MIDDLE: Zone A | Zone B | Zone C ===================== */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ---------------- ZONE A — Left navigation (280px) ---------------- */}
        <nav
          aria-label="Operations navigation"
          style={{
            width: '280px', flexShrink: 0, borderRight: '1px solid #e5e7eb',
            borderLeft: treatment.zoneABorder, display: 'flex', flexDirection: 'column',
            overflowY: 'auto', backgroundColor: '#fafafa',
          }}
        >
          {/* A1 — Venue selector */}
          <section style={{ padding: '0.875rem 1rem' }}>
            <h2 style={zoneLabel}>Venues</h2>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              {isLoading && <UnavailableNote>Loading venues…</UnavailableNote>}
              {isError && (
                <span style={{ color: '#991b1b', fontSize: '0.78rem' }}>
                  Venue list unavailable.
                </span>
              )}
              {venues?.map((venue) => (
                <Link
                  key={venue.id}
                  to={`/venues/${venue.id}`}
                  role="listitem"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: '6px',
                    textDecoration: 'none', color: '#1f2937', fontSize: '0.82rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {venue.name}
                  </span>
                  {/* Per-venue player state is not yet in the venue payload.
                      Render a neutral dot rather than implying a health colour (FP-06). */}
                  <StatusDot colour="#cbd5e1" title="Per-venue player state unavailable" />
                </Link>
              ))}
              {!isLoading && !isError && venueCount === 0 && (
                <UnavailableNote>No venues found.</UnavailableNote>
              )}
            </div>
          </section>

          {/* A2 — Incident list */}
          <section style={{ padding: '0.875rem 1rem', borderTop: '1px solid #f0f0f0' }}>
            <h2 style={zoneLabel}>Active Incidents</h2>
            <div style={{ marginTop: '0.5rem' }}>
              {/* Incident feed endpoint/type not yet defined. Per FP-06 we do not
                  assert "no incidents" (a positive confirmation we cannot make). */}
              <UnavailableNote>Incident feed unavailable.</UnavailableNote>
            </div>
          </section>

          {/* A3 — Notification tray access */}
          <section style={{ padding: '0.875rem 1rem', borderTop: '1px solid #f0f0f0' }}>
            <h2 style={zoneLabel}>🔔 Notifications</h2>
            <div style={{ marginTop: '0.5rem' }}>
              <UnavailableNote>Notification feed unavailable.</UnavailableNote>
            </div>
          </section>

          <div style={{ flex: 1 }} />

          {/* A4 — Operator tools */}
          <section style={{ padding: '0.875rem 1rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1f2937' }}>
              Operator · {String(role ?? '—')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.15rem 0 0.625rem' }}>
              {/* Operator identity / session start / certification level are not yet
                  exposed by the session provider. */}
              Session details unavailable
            </div>
            {/* Start Handoff + Request Elevated Session presence depends on the
                VIEWER boundary (absent for VIEWER). Boundary undefined. */}
            {/* TODO: A-07 — authority boundary undefined */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <AuthorityPlaceholder label="Start Handoff · Request Elevated Session" />
              <Link
                to="/login"
                style={{
                  display: 'block', textAlign: 'center', padding: '0.4rem 0.625rem',
                  borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff',
                  color: '#374151', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 500,
                }}
              >
                Sign Out
              </Link>
            </div>
          </section>
        </nav>

        {/* ---------------- ZONE B — Fleet Overview (fluid) ---------------- */}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '1.5rem' }}>
          <FleetOverview
            venues={venues}
            isLoading={isLoading}
            isError={isError}
            error={error}
            constitutionalState={constitutionalState}
          />
        </main>

        {/* ---------------- ZONE C — Right panel (320px / 48px) ---------------- */}
        <aside
          style={{
            width: zoneCExpanded ? '320px' : '48px', flexShrink: 0,
            borderLeft: '1px solid #e5e7eb', backgroundColor: treatment.zoneCTint,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transition: 'width 0.15s ease',
          }}
        >
          {zoneCExpanded ? (
            <ZoneCExpanded
              tab={zoneCTab}
              setTab={setZoneCTab}
              collapse={treatment.freeze ? undefined : () => setZoneCCollapsed(true)}
              freeze={treatment.freeze}
              constitutionalState={constitutionalState}
              venueCount={venueCount}
            />
          ) : (
            // Collapsed rail must keep the constitutional state visible (ZoneCPanel rule).
            <button
              type="button"
              onClick={() => setZoneCCollapsed(false)}
              aria-label="Expand Zone C panel"
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '0.75rem 0', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1rem' }}>›</span>
              <StatusDot colour={BADGE_COLOURS[constitutionalState]?.text ?? '#374151'} />
            </button>
          )}
        </aside>
      </div>

      {/* ===================== AUDIT TRACE FOOTER (28px, z 1000) ===================== */}
      <footer
        style={{
          height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center',
          padding: '0 1rem', zIndex: 1000, borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb', color: '#6b7280', fontSize: '0.72rem',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        title="Audit trace feed not yet wired — passive display only."
      >
        {/* AuditTraceFooter is read-only by contract — no interactive elements. */}
        Last action: <UnavailableNote>audit trace unavailable</UnavailableNote>
      </footer>
    </div>
  );
}

/* ================================================================== *
 * ZONE B — Fleet Overview workspace
 * ================================================================== */

function FleetOverview({
  venues,
  isLoading,
  isError,
  error,
  constitutionalState,
}: {
  venues: Venue[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  constitutionalState: string;
}): JSX.Element {
  const count = venues?.length ?? 0;

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Fleet Overview</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
          {isLoading
            ? 'Loading venues…'
            : isError
            ? 'Venue list unavailable'
            : `${count} ${count === 1 ? 'venue' : 'venues'}`}
          {/* Health distribution (healthy / degraded / offline) requires per-venue
              state from the venue health API — not yet available. */}
          {!isLoading && !isError && count > 0 && (
            <> · <UnavailableNote>health distribution unavailable</UnavailableNote></>
          )}
        </p>
      </div>

      {isError && (
        <div
          role="alert"
          style={{
            padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '6px', color: '#991b1b',
          }}
        >
          Failed to load venues: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {!isError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {isLoading && <UnavailableNote>Loading fleet…</UnavailableNote>}
          {venues?.map((venue) => (
            <VenueCard key={venue.id} venue={venue} constitutionalState={constitutionalState} />
          ))}
          {!isLoading && count === 0 && (
            <p style={{ color: '#6b7280' }}>No venues found. Create one via the CMS API.</p>
          )}
        </div>
      )}
    </div>
  );
}

function VenueCard({
  venue,
  constitutionalState,
}: {
  venue: Venue;
  constitutionalState: string;
}): JSX.Element {
  return (
    <article
      role="listitem"
      style={{
        border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.875rem 1rem',
        backgroundColor: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{venue.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
            {venue.timezone} · {venue.id}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {/* Constitutional state is platform-wide in Phase 1 — per-venue state
              requires the future venue health API (carried over from the original). */}
          <ConstitutionalBadge state={constitutionalState} />
          <Link
            to={`/venues/${venue.id}`}
            aria-label={`Open venue: ${venue.name}`}
            style={{
              padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #d1d5db',
              color: '#1d4ed8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Open →
          </Link>
        </div>
      </div>
      <div style={{ marginTop: '0.625rem', fontSize: '0.78rem' }}>
        {/* PRE level · override count · last heartbeat · incident status all require
            the per-venue health API. Rendered honestly rather than fabricated. */}
        <UnavailableNote>
          Operational summary unavailable — PRE level, overrides &amp; heartbeat
          pending the venue health API.
        </UnavailableNote>
      </div>
    </article>
  );
}

/* ================================================================== *
 * ZONE C — Intelligence panel (expanded)
 * ================================================================== */

function ZoneCExpanded({
  tab,
  setTab,
  collapse,
  freeze,
  constitutionalState,
  venueCount,
}: {
  tab: 'context' | 'health' | 'activity' | 'advisory';
  setTab: (t: 'context' | 'health' | 'activity' | 'advisory') => void;
  /** undefined when collapse is locked (EMERGENCY_FREEZE). */
  collapse: (() => void) | undefined;
  freeze: boolean;
  constitutionalState: string;
  venueCount: number;
}): JSX.Element {
  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: 'context', label: 'Context' },
    { id: 'health', label: 'Health' },
    { id: 'activity', label: 'Activity' },
    { id: 'advisory', label: 'Advisory' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Tab strip */}
      <div
        role="tablist"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.5rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '0.25rem 0.4rem', fontSize: '0.74rem',
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? '#111827' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #1d4ed8' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={collapse}
          disabled={!collapse}
          aria-label="Collapse Zone C panel"
          title={freeze ? 'Zone C cannot be collapsed during Emergency Freeze' : 'Collapse panel'}
          style={{
            border: 'none', background: 'transparent',
            cursor: collapse ? 'pointer' : 'not-allowed',
            color: collapse ? '#6b7280' : '#cbd5e1', fontSize: '1rem', padding: '0 0.25rem',
          }}
        >
          ‹
        </button>
      </div>

      {/* Pane body */}
      <div style={{ padding: '0.875rem 1rem', overflowY: 'auto', flex: 1 }}>
        {tab === 'context' && (
          <div>
            <h3 style={paneTitle}>C1 — Fleet Context</h3>
            <Row label="Venues">{venueCount || <UnavailableNote>—</UnavailableNote>}</Row>
            <Row label="Health distribution">
              <UnavailableNote>unavailable</UnavailableNote>
            </Row>
            <Row label="Active incidents">
              <UnavailableNote>feed unavailable</UnavailableNote>
            </Row>
            <Row label="Constitutional state">
              <ConstitutionalBadge state={constitutionalState} />
            </Row>
          </div>
        )}

        {tab === 'health' && (
          <div>
            <h3 style={paneTitle}>C2 — System Health Indicators</h3>
            <Row label="Constitutional">
              <ConstitutionalBadge state={constitutionalState} />
            </Row>
            <Row label="Per-venue health">
              <UnavailableNote>venue health API pending</UnavailableNote>
            </Row>
          </div>
        )}

        {tab === 'activity' && (
          <div>
            <h3 style={paneTitle}>C3 — Historical Activity</h3>
            <UnavailableNote>Activity feed unavailable.</UnavailableNote>
          </div>
        )}

        {tab === 'advisory' && (
          <div>
            <h3 style={paneTitle}>C4 — Constitutional Advisory</h3>
            <AdvisoryBody state={constitutionalState} />
          </div>
        )}
      </div>
    </div>
  );
}

function AdvisoryBody({ state }: { state: string }): JSX.Element {
  if (state === 'EMERGENCY_FREEZE') {
    return (
      <div
        style={{
          border: '2px solid #dc2626', borderRadius: '8px', padding: '0.75rem',
          backgroundColor: '#fff', color: '#991b1b', fontSize: '0.8rem', lineHeight: 1.5,
        }}
      >
        <strong>EMERGENCY FREEZE is active.</strong>
        <p style={{ margin: '0.5rem 0 0' }}>
          All content changes are halted. Only emergency content management actions
          are permitted. Do not attempt to place overrides or modify schedules until
          the freeze is lifted.
        </p>
      </div>
    );
  }
  if (state === 'HEALTHY') {
    return <UnavailableNote>No active advisory — systems nominal.</UnavailableNote>;
  }
  return (
    <div
      style={{
        border: '1px solid #f59e0b', borderRadius: '8px', padding: '0.75rem',
        backgroundColor: '#fffbeb', color: '#854d0e', fontSize: '0.8rem', lineHeight: 1.5,
      }}
    >
      System is degraded. Some resolution paths may be impaired. Monitor for escalation.
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6',
        fontSize: '0.8rem',
      }}
    >
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#111827', textAlign: 'right' }}>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared style constants
 * ------------------------------------------------------------------ */

const zoneLabel: React.CSSProperties = {
  margin: 0, fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const paneTitle: React.CSSProperties = {
  margin: '0 0 0.625rem', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
