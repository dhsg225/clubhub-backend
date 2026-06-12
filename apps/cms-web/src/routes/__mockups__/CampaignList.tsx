/**
 * Campaign List — all campaigns (content items) for the authenticated organization.
 * Route: `/campaigns`. Renders inside AppLayout's padded <main>, so this is an
 * in-flow content page — NOT the fixed full-viewport Live Operations surface.
 *
 * Data shape (GET /content, proxied to http://localhost:4000/content):
 *   { id, template_type, data (JSONB), created_at, status }
 * There is no `title` column at the DB level — the display title is derived from
 * `data.title ?? data.name ?? template_type`.
 *
 * Visual language follows FleetDashboard.mockup.tsx: inline styles only, system-ui
 * type, the badge / card-row idiom, and the honest loading / error / empty states
 * (UnavailableNote). No new dependencies.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client.js';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type CampaignStatus = 'draft' | 'active' | 'scheduled' | 'expired';

interface ContentItem {
  id: string;
  template_type: string;
  /** JSONB blob — shape varies by template_type, so values are unknown. */
  data: Record<string, unknown> | null;
  created_at: string;
  status: CampaignStatus;
}

/* ------------------------------------------------------------------ *
 * Status visual treatments — mirrors the ConstitutionalBadge palette idiom
 * from the FleetDashboard mockup (soft bg + readable text token).
 * ------------------------------------------------------------------ */

const STATUS_COLOURS: Record<CampaignStatus, { bg: string; text: string }> = {
  active:    { bg: '#dcfce7', text: '#166534' },
  scheduled: { bg: '#dbeafe', text: '#1e40af' },
  draft:     { bg: '#f3f4f6', text: '#374151' },
  expired:   { bg: '#fee2e2', text: '#991b1b' },
};

const STATUS_ORDER: CampaignStatus[] = ['active', 'scheduled', 'draft', 'expired'];

function StatusBadge({ status }: { status: CampaignStatus }): JSX.Element {
  const palette = STATUS_COLOURS[status] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span
      style={{
        display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px',
        fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em',
        textTransform: 'capitalize', backgroundColor: palette.bg, color: palette.text,
      }}
    >
      {status}
    </span>
  );
}

/** Muted "data not yet available" note — carried over from the mockup (FP-06). */
function UnavailableNote({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.78rem' }}>{children}</span>
  );
}

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

/** No `title` column exists — derive from data.title ?? data.name ?? template_type. */
function deriveTitle(item: ContentItem): string {
  const d = item.data ?? {};
  if (typeof d.title === 'string' && d.title.trim()) return d.title;
  if (typeof d.name === 'string' && d.name.trim()) return d.name;
  return item.template_type;
}

/** Whether the title shown is a real label or a template_type fallback. */
function isTitleDerivedFromTemplate(item: ContentItem): boolean {
  const d = item.data ?? {};
  const hasTitle = typeof d.title === 'string' && d.title.trim();
  const hasName = typeof d.name === 'string' && d.name.trim();
  return !hasTitle && !hasName;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

type StatusFilter = CampaignStatus | 'all';

export function Component(): JSX.Element {
  const { data: items, isLoading, isError, error } = useQuery<ContentItem[]>({
    queryKey: ['content'],
    queryFn: () => api.get<ContentItem[]>('/content'),
  });

  const [filter, setFilter] = useState<StatusFilter>('all');

  // Per-status counts, computed once from the full list for the filter chips.
  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: items?.length ?? 0, active: 0, scheduled: 0, draft: 0, expired: 0,
    };
    for (const item of items ?? []) {
      if (item.status in base) base[item.status] += 1;
    }
    return base;
  }, [items]);

  const visible = useMemo(
    () => (filter === 'all' ? items ?? [] : (items ?? []).filter((i) => i.status === filter)),
    [items, filter],
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Campaigns</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
          {isLoading
            ? 'Loading campaigns…'
            : isError
            ? 'Campaign list unavailable'
            : `${counts.all} ${counts.all === 1 ? 'campaign' : 'campaigns'}`}
        </p>
      </div>

      {/* Status filter chips */}
      {!isError && (
        <div
          role="tablist"
          aria-label="Filter by status"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}
        >
          {(['all', ...STATUS_ORDER] as StatusFilter[]).map((key) => {
            const selected = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(key)}
                disabled={isLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.7rem', borderRadius: '999px', cursor: isLoading ? 'default' : 'pointer',
                  border: selected ? '1px solid #1d4ed8' : '1px solid #d1d5db',
                  backgroundColor: selected ? '#eff6ff' : '#fff',
                  color: selected ? '#1d4ed8' : '#374151',
                  fontSize: '0.78rem', fontWeight: selected ? 600 : 500,
                  textTransform: 'capitalize',
                }}
              >
                {key}
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums', fontSize: '0.72rem',
                    color: selected ? '#1d4ed8' : '#9ca3af',
                  }}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          style={{
            padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem',
          }}
        >
          Failed to load campaigns: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Loading state */}
      {isLoading && <UnavailableNote>Loading campaigns…</UnavailableNote>}

      {/* List */}
      {!isLoading && !isError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {visible.map((item) => (
            <CampaignRow key={item.id} item={item} />
          ))}

          {visible.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {counts.all === 0
                ? 'No campaigns yet. Create content via the CMS API.'
                : `No ${filter} campaigns.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Campaign row — card idiom carried over from VenueCard in the mockup.
 * ------------------------------------------------------------------ */

function CampaignRow({ item }: { item: ContentItem }): JSX.Element {
  const title = deriveTitle(item);
  const titleIsFallback = isTitleDerivedFromTemplate(item);

  return (
    <Link
      to={`/content/${item.id}`}
      aria-label={`Open campaign: ${title}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem 1rem',
        backgroundColor: '#fff', textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.95rem', fontWeight: 600, color: '#111827',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontStyle: titleIsFallback ? 'italic' : 'normal',
          }}
          title={titleIsFallback ? 'No title in content data — showing template type' : undefined}
        >
          {title}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>
          {item.template_type} · Created {formatDate(item.created_at)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <StatusBadge status={item.status} />
        <span style={{ color: '#1d4ed8', fontSize: '0.85rem', fontWeight: 600 }} aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}
