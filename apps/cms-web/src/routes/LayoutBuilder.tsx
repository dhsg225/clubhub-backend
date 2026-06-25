/**
 * Layout Builder — list + create/edit screen layouts.
 * Route: /layouts (list), /layouts/new (create), /layouts/:slug/edit (edit)
 * BL-048 Part 2.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api-client.js';

/* ------------------------------------------------------------------ *
 * Widget types + config editor
 * ------------------------------------------------------------------ */

interface WidgetApiRow {
  slug: string;
  display_name: string;
  config_schema: { fields: { key: string; label: string; type: string; default?: string; options?: string[] }[] };
}

function WidgetConfigFields({ widgetSlug, widgets, config, onChange }: {
  widgetSlug: string;
  widgets: WidgetApiRow[];
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}): JSX.Element | null {
  const widget = widgets.find((w) => w.slug === widgetSlug);
  if (!widget || widget.config_schema.fields.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingLeft: '0.25rem' }}>
      {widget.config_schema.fields.map((f) => (
        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.7rem', color: '#6b7280', minWidth: '60px' }}>{f.label}:</label>
          {f.type === 'select' && f.options ? (
            <select
              value={(config[f.key] as string) ?? f.default ?? ''}
              onChange={(e) => onChange({ ...config, [f.key]: e.target.value })}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.3rem', borderRadius: '3px', border: '1px solid #d1d5db' }}
            >
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={(config[f.key] as string) ?? f.default ?? ''}
              onChange={(e) => onChange({ ...config, [f.key]: e.target.value })}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.3rem', borderRadius: '3px', border: '1px solid #d1d5db', width: '100px' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

interface WidgetSlotDef {
  zone: string;
  position: 'left-fixed' | 'fill' | 'full';
  width?: number;
  widget: string;
  corpus_key?: string;
}

interface LayoutDefinition {
  grid_areas: string;
  grid_rows: string;
  grid_cols: string;
  playlist_zones: string[];
  widget_slots: WidgetSlotDef[];
}

interface LayoutRow {
  slug: string;
  display_name: string;
  definition: LayoutDefinition;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Zone grid preview SVG (shared between list + editor)
 * ------------------------------------------------------------------ */

function LayoutDiagram({ definition, width = 120, height = 68 }: {
  definition: LayoutDefinition;
  width?: number;
  height?: number;
}): JSX.Element {
  const zones = parseGridAreas(definition.grid_areas);
  const rowCount = zones.length || 1;
  const colCount = zones[0]?.length || 1;
  const cellW = width / colCount;
  const cellH = height / rowCount;

  // Deduplicate zone rectangles (merged cells share a name)
  const rects = computeZoneRects(zones, cellW, cellH);
  const playlistSet = new Set(definition.playlist_zones);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ borderRadius: '3px', border: '1px solid #d1d5db' }}>
      <rect width={width} height={height} fill="#1e293b" />
      {rects.map((r) => (
        <g key={r.name}>
          <rect x={r.x + 1} y={r.y + 1} width={r.w - 2} height={r.h - 2}
            rx={2} fill={playlistSet.has(r.name) ? '#1e40af' : '#065f46'} opacity={0.7} />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="central"
            fill="#fff" fontSize={Math.min(9, r.w / r.name.length * 1.4)} fontFamily="system-ui">
            {r.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function parseGridAreas(gridAreas: string): string[][] {
  const rows: string[][] = [];
  const matches = gridAreas.match(/"([^"]+)"/g);
  if (!matches) return [['main']];
  for (const m of matches) {
    rows.push(m.replace(/"/g, '').trim().split(/\s+/));
  }
  return rows;
}

interface ZoneRect { name: string; x: number; y: number; w: number; h: number; }

function computeZoneRects(grid: string[][], cellW: number, cellH: number): ZoneRect[] {
  const seen = new Map<string, { r1: number; c1: number; r2: number; c2: number }>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const name = grid[r]![c]!;
      const existing = seen.get(name);
      if (existing) {
        existing.r2 = Math.max(existing.r2, r);
        existing.c2 = Math.max(existing.c2, c);
      } else {
        seen.set(name, { r1: r, c1: c, r2: r, c2: c });
      }
    }
  }
  const rects: ZoneRect[] = [];
  for (const [name, b] of seen) {
    rects.push({
      name,
      x: b.c1 * cellW,
      y: b.r1 * cellH,
      w: (b.c2 - b.c1 + 1) * cellW,
      h: (b.r2 - b.r1 + 1) * cellH,
    });
  }
  return rects;
}

/* ================================================================== *
 * LIST VIEW
 * ================================================================== */

export function Component(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: layouts, isLoading, isError, error } = useQuery<LayoutRow[]>({
    queryKey: ['layouts'],
    queryFn: () => api.get<LayoutRow[]>('/layouts'),
  });

  const { mutate: deleteLayout, isPending: deleting } = useMutation({
    mutationFn: (slug: string) => api.delete<{ deleted: boolean }>(`/layouts/${slug}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['layouts'] }),
  });

  function handleDelete(layout: LayoutRow): void {
    if (!window.confirm(`Delete layout "${layout.display_name}"?`)) return;
    deleteLayout(layout.slug);
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '960px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Layouts</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
            {isLoading ? 'Loading…' : isError ? 'Unavailable' : `${layouts?.length ?? 0} layouts`}
          </p>
        </div>
        <Link to="/layouts/new" style={{
          flexShrink: 0, display: 'inline-block', padding: '0.5rem 1rem',
          backgroundColor: '#1d4ed8', color: '#fff', borderRadius: '6px',
          textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          + New layout
        </Link>
      </div>

      {isError && (
        <div role="alert" style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.875rem' }}>
          Failed to load layouts: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {isLoading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading layouts…</p>}

      {!isLoading && !isError && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Preview</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Zones</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {(layouts ?? []).map((layout) => {
                const zoneCount = layout.definition.playlist_zones.length + layout.definition.widget_slots.length;
                return (
                  <tr key={layout.slug} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdCellStyle}><LayoutDiagram definition={layout.definition} width={80} height={45} /></td>
                    <td style={tdCellStyle}>
                      <span style={{ fontWeight: 500 }}>{layout.display_name}</span>
                      {layout.is_system && (
                        <span title="System layout" style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#6b7280' }}>&#128274;</span>
                      )}
                    </td>
                    <td style={{ ...tdCellStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>{layout.slug}</td>
                    <td style={tdCellStyle}>{zoneCount}</td>
                    <td style={{ ...tdCellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => window.open(`/preview/layout/${layout.slug}`, '_blank', 'width=1280,height=720')}
                        style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem' }}
                      >
                        ▶
                      </button>
                      <Link to={`/layouts/${layout.slug}/edit`} style={{ color: '#1d4ed8', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', marginRight: '0.75rem' }}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={layout.is_system || deleting}
                        title={layout.is_system ? 'System layouts cannot be deleted' : 'Delete layout'}
                        onClick={() => handleDelete(layout)}
                        style={{
                          fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px',
                          color: layout.is_system ? '#9ca3af' : '#dc2626',
                          backgroundColor: layout.is_system ? '#f9fafb' : '#fef2f2',
                          border: `1px solid ${layout.is_system ? '#e5e7eb' : '#fecaca'}`,
                          cursor: layout.is_system ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 * PRESETS — visual starting points for layout creation
 * ================================================================== */

interface LayoutPreset {
  id: string;
  label: string;
  description: string;
  definition: LayoutDefinition;
  suggestedSlug: string;
}

const PRESETS: LayoutPreset[] = [
  {
    id: 'full_screen',
    label: 'Full Screen',
    description: 'Single zone, edge to edge',
    suggestedSlug: 'fullscreen',
    definition: {
      grid_areas: '"main"', grid_rows: '1fr', grid_cols: '1fr',
      playlist_zones: ['main'], widget_slots: [],
    },
  },
  {
    id: 'side_by_side',
    label: 'Side by Side',
    description: 'Two equal columns',
    suggestedSlug: 'side_by_side',
    definition: {
      grid_areas: '"left right"', grid_rows: '1fr', grid_cols: '1fr 1fr',
      playlist_zones: ['left', 'right'], widget_slots: [],
    },
  },
  {
    id: 'main_sidebar',
    label: 'Main + Sidebar',
    description: 'Large left, narrow right',
    suggestedSlug: 'main_sidebar',
    definition: {
      grid_areas: '"main sidebar"', grid_rows: '1fr', grid_cols: '7fr 3fr',
      playlist_zones: ['main', 'sidebar'], widget_slots: [],
    },
  },
  {
    id: 'main_ticker',
    label: 'Main + Ticker',
    description: 'Content above, scrolling bar below',
    suggestedSlug: 'news_bar',
    definition: {
      grid_areas: '"main" "ticker"', grid_rows: '90% 10%', grid_cols: '1fr',
      playlist_zones: ['main'],
      widget_slots: [
        { zone: 'ticker', position: 'left-fixed', width: 120, widget: 'clock' },
        { zone: 'ticker', position: 'fill', widget: 'ticker_scroll', corpus_key: 'ticker_items' },
      ],
    },
  },
  {
    id: 'l_shape',
    label: 'L-Shape',
    description: 'Main + sidebar + bottom bar',
    suggestedSlug: 'l_shape',
    definition: {
      grid_areas: '"main sidebar" "ticker ticker"', grid_rows: '85% 15%', grid_cols: '7fr 3fr',
      playlist_zones: ['main', 'sidebar'],
      widget_slots: [
        { zone: 'ticker', position: 'left-fixed', width: 120, widget: 'clock' },
        { zone: 'ticker', position: 'fill', widget: 'ticker_scroll', corpus_key: 'ticker_items' },
      ],
    },
  },
  {
    id: 'quad',
    label: 'Quad',
    description: 'Four equal zones',
    suggestedSlug: 'quad',
    definition: {
      grid_areas: '"top_left top_right" "bottom_left bottom_right"', grid_rows: '1fr 1fr', grid_cols: '1fr 1fr',
      playlist_zones: ['top_left', 'top_right', 'bottom_left', 'bottom_right'], widget_slots: [],
    },
  },
  {
    id: 'triple',
    label: 'Triple',
    description: 'Three equal columns',
    suggestedSlug: 'triple',
    definition: {
      grid_areas: '"left center right"', grid_rows: '1fr', grid_cols: '1fr 1fr 1fr',
      playlist_zones: ['left', 'center', 'right'], widget_slots: [],
    },
  },
  {
    id: 'split_ticker',
    label: 'Split + Ticker',
    description: 'Two columns above, ticker below',
    suggestedSlug: 'split_horizontal',
    definition: {
      grid_areas: '"main_left main_right" "ticker ticker"', grid_rows: '90% 10%', grid_cols: '1fr 1fr',
      playlist_zones: ['main_left', 'main_right'],
      widget_slots: [
        { zone: 'ticker', position: 'left-fixed', width: 120, widget: 'clock' },
        { zone: 'ticker', position: 'fill', widget: 'ticker_scroll', corpus_key: 'ticker_items' },
      ],
    },
  },
];

/* ================================================================== *
 * EDITOR VIEW (imported via lazy route)
 * ================================================================== */

export function LayoutEditor(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const isNew = !slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Load existing layout for edit mode
  const { data: existing, isLoading: loadingExisting } = useQuery<LayoutRow>({
    queryKey: ['layout', slug],
    queryFn: () => api.get<LayoutRow>(`/layouts/${slug}`),
    enabled: !!slug,
  });

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [definition, setDefinition] = useState<LayoutDefinition | null>(null);
  const [zoneTypes, setZoneTypes] = useState<Record<string, 'playlist' | 'widget'>>({});
  const [widgetKinds, setWidgetKinds] = useState<Record<string, string>>({});
  const [widgetPositions, setWidgetPositions] = useState<Record<string, 'left-fixed' | 'fill'>>({});
  const [widgetWidths, setWidgetWidths] = useState<Record<string, number>>({});
  const [widgetConfigs, setWidgetConfigs] = useState<Record<string, Record<string, unknown>>>({});
  const [initialized, setInitialized] = useState(false);

  // Fetch available widgets from API
  const { data: availableWidgets } = useQuery<WidgetApiRow[]>({
    queryKey: ['widgets'],
    queryFn: () => api.get<WidgetApiRow[]>('/widgets'),
  });
  const [validationError, setValidationError] = useState('');

  // Initialize from existing layout when loaded (edit mode)
  if (slug && existing && !initialized) {
    setDisplayName(existing.display_name);
    setSlugInput(existing.slug);
    setDefinition(existing.definition);
    const types: Record<string, 'playlist' | 'widget'> = {};
    for (const z of existing.definition.playlist_zones) types[z] = 'playlist';
    const kinds: Record<string, string> = {};
    const positions: Record<string, 'left-fixed' | 'fill'> = {};
    const widths: Record<string, number> = {};
    for (const ws of existing.definition.widget_slots) {
      types[ws.zone] = 'widget';
      kinds[ws.zone] = ws.widget;
      positions[ws.zone] = ws.position === 'left-fixed' ? 'left-fixed' : 'fill';
      if (ws.width) widths[ws.zone] = ws.width;
    }
    setZoneTypes(types);
    setWidgetKinds(kinds);
    setWidgetPositions(positions);
    setWidgetWidths(widths);
    setSelectedPreset('__existing__');
    setInitialized(true);
  }

  function handlePresetSelect(preset: LayoutPreset): void {
    setSelectedPreset(preset.id);
    setDefinition(preset.definition);
    setDisplayName(preset.label);
    setSlugInput(preset.suggestedSlug);

    // Set zone types from the preset definition
    const types: Record<string, 'playlist' | 'widget'> = {};
    for (const z of preset.definition.playlist_zones) types[z] = 'playlist';
    const kinds: Record<string, string> = {};
    const positions: Record<string, 'left-fixed' | 'fill'> = {};
    const widths: Record<string, number> = {};
    for (const ws of preset.definition.widget_slots) {
      types[ws.zone] = 'widget';
      kinds[ws.zone] = ws.widget;
      positions[ws.zone] = ws.position === 'left-fixed' ? 'left-fixed' : 'fill';
      if (ws.width) widths[ws.zone] = ws.width;
    }
    setZoneTypes(types);
    setWidgetKinds(kinds);
    setWidgetPositions(positions);
    setWidgetWidths(widths);
    setValidationError('');
  }

  // All zone names from the current definition
  const allZoneNames = useMemo(() => {
    if (!definition) return [];
    const names = new Set<string>();
    const parsed = parseGridAreas(definition.grid_areas);
    for (const row of parsed) for (const cell of row) if (cell.trim()) names.add(cell.trim());
    return [...names];
  }, [definition]);

  // Build final definition incorporating zone type overrides
  function buildFinalDefinition(): LayoutDefinition {
    if (!definition) return PRESETS[0]!.definition;
    const playlistZones: string[] = [];
    const widgetSlots: WidgetSlotDef[] = [];
    for (const name of allZoneNames) {
      const type = zoneTypes[name] ?? 'playlist';
      if (type === 'playlist') {
        playlistZones.push(name);
      } else {
        const widget = widgetKinds[name] ?? 'clock';
        const position = widgetPositions[name] ?? 'fill';
        const slot: WidgetSlotDef = { zone: name, position, widget };
        if (position === 'left-fixed') slot.width = widgetWidths[name] ?? 120;
        if (widget === 'ticker_scroll') slot.corpus_key = 'ticker_items';
        const cfg = widgetConfigs[name];
        if (cfg && Object.keys(cfg).length > 0) (slot as any).config = cfg;
        widgetSlots.push(slot);
      }
    }
    return { ...definition, playlist_zones: playlistZones, widget_slots: widgetSlots };
  }

  const { mutate: saveLayout, isPending: saving, error: saveError } = useMutation({
    mutationFn: (def: LayoutDefinition) => {
      if (isNew) {
        return api.post<LayoutRow>('/layouts', { slug: slugInput.trim(), display_name: displayName.trim(), definition: def, sort_order: 99 });
      }
      return api.patch<LayoutRow>(`/layouts/${slug}`, { display_name: displayName.trim(), definition: def });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['layouts'] });
      navigate('/layouts');
    },
  });

  function handleSave(): void {
    if (!displayName.trim()) { setValidationError('Display name is required.'); return; }
    if (isNew && !slugInput.trim()) { setValidationError('Slug is required.'); return; }
    if (!definition) { setValidationError('Select a layout preset first.'); return; }
    setValidationError('');
    saveLayout(buildFinalDefinition());
  }

  if (slug && loadingExisting) {
    return <div style={{ fontFamily: 'system-ui, sans-serif', color: '#6b7280' }}>Loading layout…</div>;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '860px' }}>
      <Link to="/layouts" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
        &larr; Layouts
      </Link>
      <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>
        {isNew ? 'New Layout' : `Edit: ${existing?.display_name ?? slug}`}
      </h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
        {isNew ? 'Choose how the screen is divided, then customise zone types.' : 'Adjust zone types and save.'}
      </p>

      {/* Step 1: Preset selector (only for new layouts) */}
      {isNew && (
        <div style={{ marginBottom: '2rem' }}>
          <label style={editorLabelStyle}>Choose a layout</label>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}>
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                style={{
                  padding: '0.75rem',
                  border: selectedPreset === preset.id ? '2px solid #1d4ed8' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: selectedPreset === preset.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <LayoutDiagram definition={preset.definition} width={120} height={68} />
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827' }}>{preset.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.15rem' }}>{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Name + slug + customisation (shown after preset selected, or always in edit mode) */}
      {(selectedPreset || !isNew) && definition && (
        <>
          {/* Name + slug */}
          <div style={{ display: 'grid', gridTemplateColumns: isNew ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={editorLabelStyle}>Display name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Lobby Display" style={editorInputStyle} />
            </div>
            {isNew && (
              <div>
                <label style={editorLabelStyle}>Slug</label>
                <input type="text" value={slugInput} onChange={(e) => setSlugInput(e.target.value.replace(/[^a-z0-9_]/g, ''))} placeholder="e.g. lobby_display" style={{ ...editorInputStyle, fontFamily: 'monospace' }} />
              </div>
            )}
          </div>

          {/* Live preview + zone config side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
            {/* Preview */}
            <div>
              <label style={editorLabelStyle}>Preview</label>
              <LayoutDiagram definition={buildFinalDefinition()} width={380} height={214} />
            </div>

            {/* Zone configuration */}
            <div>
              <label style={editorLabelStyle}>Zones</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {allZoneNames.map((name) => {
                  const type = zoneTypes[name] ?? 'playlist';
                  return (
                    <div key={name} style={{
                      padding: '0.5rem 0.65rem', border: '1px solid #e5e7eb', borderRadius: '6px',
                      fontSize: '0.8rem', backgroundColor: '#fafafa',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: type === 'widget' ? '0.4rem' : 0 }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem',
                          padding: '0.1rem 0.4rem', borderRadius: '3px',
                          backgroundColor: type === 'widget' ? '#065f46' : '#1e40af',
                          color: '#fff',
                        }}>{name}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                          <input type="radio" name={`type-${name}`} checked={type === 'playlist'} onChange={() => setZoneTypes((p) => ({ ...p, [name]: 'playlist' }))} />
                          Playlist
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                          <input type="radio" name={`type-${name}`} checked={type === 'widget'} onChange={() => setZoneTypes((p) => ({ ...p, [name]: 'widget' }))} />
                          Widget
                        </label>
                      </div>
                      {type === 'widget' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={widgetKinds[name] ?? 'clock'} onChange={(e) => setWidgetKinds((p) => ({ ...p, [name]: e.target.value }))} style={miniSelectStyle}>
                              {(availableWidgets ?? []).map((w) => (
                                <option key={w.slug} value={w.slug}>{w.display_name}</option>
                              ))}
                              {(!availableWidgets || availableWidgets.length === 0) && (
                                <>
                                  <option value="clock">Clock</option>
                                  <option value="ticker_scroll">Ticker Scroll</option>
                                  <option value="date_display">Date Display</option>
                                </>
                              )}
                            </select>
                            <select value={widgetPositions[name] ?? 'fill'} onChange={(e) => setWidgetPositions((p) => ({ ...p, [name]: e.target.value as 'left-fixed' | 'fill' }))} style={miniSelectStyle}>
                              <option value="fill">Fill</option>
                              <option value="left-fixed">Left Fixed</option>
                            </select>
                            {(widgetPositions[name] ?? 'fill') === 'left-fixed' && (
                              <input type="number" min={40} max={400} value={widgetWidths[name] ?? 120} onChange={(e) => setWidgetWidths((p) => ({ ...p, [name]: Number(e.target.value) }))}
                                style={{ width: '55px', ...miniSelectStyle }} />
                            )}
                          </div>
                          <WidgetConfigFields
                            widgetSlug={widgetKinds[name] ?? 'clock'}
                            widgets={availableWidgets ?? []}
                            config={widgetConfigs[name] ?? {}}
                            onChange={(cfg) => setWidgetConfigs((p) => ({ ...p, [name]: cfg }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Errors */}
          {validationError && (
            <div role="alert" style={{ padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '5px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {validationError}
            </div>
          )}
          {saveError && (
            <div role="alert" style={{ padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '5px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Save failed: {saveError instanceof Error ? saveError.message : String(saveError)}
            </div>
          )}

          {/* Save */}
          <button type="button" onClick={handleSave} disabled={saving} style={{
            padding: '0.65rem 1.25rem', backgroundColor: saving ? '#93c5fd' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Saving…' : isNew ? 'Create layout' : 'Save changes'}
          </button>
        </>
      )}
    </div>
  );
}

/* ── Shared styles ────────────────────────────────────────────────── */

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  fontWeight: 600, color: '#374151', fontSize: '0.75rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdCellStyle: React.CSSProperties = {
  padding: '0.65rem 0.75rem', verticalAlign: 'middle',
};

const editorLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem',
};

const editorInputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.875rem',
  fontFamily: 'system-ui, sans-serif', color: '#111827', backgroundColor: '#fff',
};

const miniSelectStyle: React.CSSProperties = {
  fontSize: '0.75rem', padding: '0.2rem 0.35rem', borderRadius: '4px',
  border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#374151',
};
