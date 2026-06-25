/**
 * Widget Gallery — browse available widgets and see which layouts use them.
 * Route: /widgets
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client.js';

/* ================================================================== *
 * Types
 * ================================================================== */

interface SchemaField {
  key: string;
  label: string;
  type: string;
  default?: string;
  required?: boolean;
  max_chars?: number;
  options?: string[];
}

interface WidgetRow {
  slug: string;
  display_name: string;
  description: string;
  config_schema: { fields: SchemaField[] };
  sort_order: number;
}

interface WidgetSlotDef {
  widget: string;
  zone: string;
  position: string;
}

interface LayoutRow {
  slug: string;
  display_name: string;
  definition: {
    widget_slots: WidgetSlotDef[];
  };
}

/* ================================================================== *
 * Static preview components (no live execution)
 * ================================================================== */

function ClockPreview(): JSX.Element {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#1e293b', borderRadius: '6px',
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
        14:30:42
      </span>
    </div>
  );
}

function DatePreview(): JSX.Element {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#1e293b', borderRadius: '6px',
    }}>
      <span style={{ fontFamily: 'system-ui', fontSize: '1.1rem', fontWeight: 500, color: '#fff' }}>
        Friday 20 June
      </span>
    </div>
  );
}

function TickerPreview(): JSX.Element {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      backgroundColor: '#1e293b', borderRadius: '6px', overflow: 'hidden', padding: '0 0.75rem',
    }}>
      <span style={{
        fontFamily: 'system-ui', fontSize: '0.85rem', fontWeight: 500, color: '#fff',
        whiteSpace: 'nowrap', opacity: 0.8,
      }}>
        Happy Hour 4–6pm &nbsp;·&nbsp; Live Music Tonight 8pm &nbsp;·&nbsp; Members Double Points ▸
      </span>
    </div>
  );
}

const PREVIEW_MAP: Record<string, () => JSX.Element> = {
  clock: ClockPreview,
  date_display: DatePreview,
  ticker_scroll: TickerPreview,
};

function WidgetPreview({ slug }: { slug: string }): JSX.Element {
  const Preview = PREVIEW_MAP[slug];
  if (Preview) return <Preview />;
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f3f4f6', borderRadius: '6px', color: '#9ca3af', fontSize: '0.8rem',
    }}>
      No preview
    </div>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const { data: widgets, isLoading, isError } = useQuery<WidgetRow[]>({
    queryKey: ['widgets'],
    queryFn: () => api.get<WidgetRow[]>('/widgets'),
  });

  const { data: layouts } = useQuery<LayoutRow[]>({
    queryKey: ['layouts'],
    queryFn: () => api.get<LayoutRow[]>('/layouts'),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const selectedWidget = widgets?.find((w) => w.slug === selected);

  // Count layouts using each widget
  function layoutsUsingWidget(slug: string): LayoutRow[] {
    if (!layouts) return [];
    return layouts.filter((l) =>
      l.definition.widget_slots?.some((ws) => ws.widget === slug),
    );
  }

  if (isLoading) {
    return <Page><p style={{ color: '#6b7280' }}>Loading widgets...</p></Page>;
  }
  if (isError || !widgets) {
    return <Page><div style={errorBox}>Failed to load widgets.</div></Page>;
  }

  return (
    <Page>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>Widgets</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          Real-time utilities that live inside layout zones. Widgets run automatically — they are not scheduled.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: '1.5rem' }}>
        {/* Grid of widget cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {widgets.map((w) => {
            const usingLayouts = layoutsUsingWidget(w.slug);
            const isActive = selected === w.slug;
            return (
              <button
                key={w.slug}
                type="button"
                onClick={() => setSelected(isActive ? null : w.slug)}
                style={{
                  border: isActive ? '2px solid #1d4ed8' : '1px solid #e5e7eb',
                  borderRadius: '8px', padding: 0, backgroundColor: '#fff',
                  cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
                }}
              >
                {/* Preview */}
                <div style={{ height: '80px', padding: '0.5rem' }}>
                  <WidgetPreview slug={w.slug} />
                </div>

                {/* Info */}
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{w.display_name}</span>
                    <code style={{ fontSize: '0.65rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                      {w.slug}
                    </code>
                  </div>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.4 }}>
                    {w.description}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: usingLayouts.length > 0 ? '#1d4ed8' : '#9ca3af' }}>
                    Used in {usingLayouts.length} layout{usingLayouts.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedWidget && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9fafb' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>{selectedWidget.display_name}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: '#6b7280', lineHeight: 1.5 }}>
              {selectedWidget.description}
            </p>

            {/* Config schema */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={sectionLabel}>Configuration</div>
              {selectedWidget.config_schema.fields.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>No configuration options.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {selectedWidget.config_schema.fields.map((f) => (
                    <div key={f.key} style={{ border: '1px solid #e5e7eb', borderRadius: '5px', padding: '0.5rem 0.6rem', backgroundColor: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>{f.key}</code>
                        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{f.type}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{f.label}</div>
                      {f.default && (
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                          Default: <code style={{ backgroundColor: '#f3f4f6', padding: '0.05rem 0.2rem', borderRadius: '2px' }}>{f.default}</code>
                        </div>
                      )}
                      {f.options && (
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                          Options: {f.options.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Layouts using this widget */}
            <div>
              <div style={sectionLabel}>Used in layouts</div>
              {layoutsUsingWidget(selectedWidget.slug).length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>Not used in any layout.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {layoutsUsingWidget(selectedWidget.slug).map((l) => (
                    <Link
                      key={l.slug}
                      to={`/layouts/${l.slug}/edit`}
                      style={{ fontSize: '0.8rem', color: '#1d4ed8', textDecoration: 'none' }}
                    >
                      {l.display_name} →
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

/* ================================================================== *
 * Shared
 * ================================================================== */

function Page({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '960px' }}>{children}</div>;
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: '0.5rem',
};

const errorBox: React.CSSProperties = {
  padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: '6px', color: '#991b1b', fontSize: '0.875rem',
};
