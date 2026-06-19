/**
 * Playlist Composer — create or edit a named playlist.
 * Routes: /playlists/new (create) and /playlists/:id (edit)
 *
 * Both use the same component. When id is absent (or 'new'), creates.
 * Otherwise loads GET /named_playlists/:id and pre-populates.
 *
 * D-013: Card → Playlist → Schedule → Screen content hierarchy.
 * Cards (from GET /content) are added to an ordered list with per-card duration.
 * ▲/▼ buttons reorder; × removes. No drag-and-drop (prohibited by D-013).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

/* ================================================================== *
 * Types
 * ================================================================== */

type OrderingRule = 'sequential' | 'shuffle';

interface CardData {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
}

interface PlaylistItem {
  content_id: string;
  duration_seconds: number;
  card: CardData | null;
}

interface NamedPlaylist {
  id: string;
  name: string;
  ordering_rule: OrderingRule;
  items: PlaylistItem[];
  created_at: string;
  updated_at: string;
}

/* Slim shape returned by GET /content */
interface ContentItem {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
  created_at: string;
  status: string;
}

/* ================================================================== *
 * Helpers
 * ================================================================== */

function cardTitle(card: { template_type: string; data: Record<string, unknown> | null }): string {
  const d = card.data ?? {};
  if (typeof d.title === 'string' && d.title.trim()) return d.title;
  if (typeof d.name === 'string' && d.name.trim()) return d.name;
  if (typeof d.event_name === 'string' && d.event_name.trim()) return d.event_name;
  if (typeof d.headline === 'string' && d.headline.trim()) return d.headline;
  if (typeof d.sponsor_name === 'string' && d.sponsor_name.trim()) return d.sponsor_name;
  return card.template_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const BADGE_COLORS: Record<string, string> = {
  promo_slide:    '#7C3AED',
  event_banner:   '#EA580C',
  sponsor_banner: '#16A34A',
  menu_board:     '#2563EB',
  daily_specials: '#DC2626',
};

function TemplateDot({ type }: { type: string }): JSX.Element {
  const color = BADGE_COLORS[type] ?? '#6b7280';
  return (
    <span style={{
      display: 'inline-block', width: '8px', height: '8px',
      borderRadius: '50%', backgroundColor: color, flexShrink: 0,
      marginTop: '0.15rem',
    }} title={type} />
  );
}

function TemplateBadge({ type }: { type: string }): JSX.Element {
  const color = BADGE_COLORS[type] ?? '#6b7280';
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.4rem', borderRadius: '3px',
      fontSize: '0.68rem', fontWeight: 600,
      backgroundColor: `${color}20`, color,
      fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

/* ================================================================== *
 * Card picker (left panel)
 * ================================================================== */

function CardPicker({
  cards,
  isLoading,
  isError,
  addedIds,
  onAdd,
}: {
  cards: ContentItem[];
  isLoading: boolean;
  isError: boolean;
  addedIds: Set<string>;
  onAdd: (card: ContentItem) => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <h2 style={sectionHeading}>Available cards</h2>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
          Click to add to the playlist. Each card can only appear once.
        </p>
      </div>

      {isLoading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading cards…</p>}
      {isError && (
        <div role="alert" style={{
          padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '5px',
          color: '#991b1b', fontSize: '0.8rem',
        }}>
          Failed to load cards
        </div>
      )}

      {!isLoading && !isError && cards.length === 0 && (
        <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
          No cards yet. <Link to="/content/new" style={{ color: '#1d4ed8' }}>Create a card</Link> first.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {cards.map((card) => {
          const already = addedIds.has(card.id);
          return (
            <div
              key={card.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                padding: '0.5rem 0.625rem', border: '1px solid #e5e7eb', borderRadius: '6px',
                backgroundColor: already ? '#f9fafb' : '#fff',
                opacity: already ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                <TemplateDot type={card.template_type} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.8rem', fontWeight: 500, color: '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cardTitle(card)}
                  </div>
                  <div style={{ marginTop: '0.1rem' }}>
                    <TemplateBadge type={card.template_type} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={already}
                onClick={() => onAdd(card)}
                style={{
                  flexShrink: 0, padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem', fontWeight: 600,
                  color: already ? '#9ca3af' : '#1d4ed8',
                  backgroundColor: already ? '#f3f4f6' : '#eff6ff',
                  border: `1px solid ${already ? '#e5e7eb' : '#bfdbfe'}`,
                  borderRadius: '4px', cursor: already ? 'not-allowed' : 'pointer',
                }}
              >
                {already ? 'Added' : '+ Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Playlist editor (right panel)
 * ================================================================== */

function PlaylistEditor({
  name, onNameChange,
  orderingRule, onOrderingRuleChange,
  items, onItemsChange,
  onSave, isSaving, saveError,
  isEdit,
}: {
  name: string;
  onNameChange: (v: string) => void;
  orderingRule: OrderingRule;
  onOrderingRuleChange: (v: OrderingRule) => void;
  items: PlaylistItem[];
  onItemsChange: (items: PlaylistItem[]) => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  isEdit: boolean;
}): JSX.Element {
  function move(index: number, direction: -1 | 1): void {
    const next = [...items];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[swap]!;
    next[swap] = tmp;
    onItemsChange(next);
  }

  function remove(index: number): void {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  function updateDuration(index: number, value: string): void {
    const secs = Math.max(5, Math.min(300, parseInt(value, 10) || 10));
    onItemsChange(items.map((it, i) => i === index ? { ...it, duration_seconds: secs } : it));
  }

  return (
    <div>
      <h2 style={sectionHeading}>{isEdit ? 'Edit playlist' : 'New playlist'}</h2>

      {/* Name */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Playlist name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={120}
          placeholder="e.g. Evening Bar Loop"
          style={inputStyle}
        />
        <span style={{ fontSize: '0.7rem', color: name.length > 110 ? '#dc2626' : '#9ca3af' }}>
          {name.length}/120
        </span>
      </div>

      {/* Ordering rule */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>Ordering</label>
        <select
          value={orderingRule}
          onChange={(e) => onOrderingRuleChange(e.target.value as OrderingRule)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="sequential">Sequential — plays in order, loops</option>
          <option value="shuffle">Shuffle — randomises on each loop</option>
        </select>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#e5e7eb', marginBottom: '1rem' }} />

      {/* Item list */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          {items.length} {items.length === 1 ? 'card' : 'cards'} in playlist
        </div>

        {items.length === 0 && (
          <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
            No cards added yet — use the card picker on the left.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {items.map((item, i) => (
            <div
              key={item.content_id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.625rem', border: '1px solid #e5e7eb', borderRadius: '6px',
                backgroundColor: '#fff',
              }}
            >
              {/* Position number */}
              <span style={{
                flexShrink: 0, width: '1.5rem', height: '1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af',
                backgroundColor: '#f3f4f6', borderRadius: '4px',
              }}>
                {i + 1}
              </span>

              {/* Card info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {item.card && <TemplateDot type={item.card.template_type} />}
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 500, color: '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.card ? cardTitle(item.card) : item.content_id}
                  </span>
                </div>
                {item.card && (
                  <div style={{ marginTop: '0.1rem' }}>
                    <TemplateBadge type={item.card.template_type} />
                  </div>
                )}
              </div>

              {/* Duration */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={item.duration_seconds}
                  onChange={(e) => updateDuration(i, e.target.value)}
                  style={{
                    width: '52px', padding: '0.25rem 0.3rem',
                    border: '1px solid #d1d5db', borderRadius: '4px',
                    fontSize: '0.78rem', textAlign: 'right',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                />
                <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>s</span>
              </div>

              {/* Reorder + remove */}
              <div style={{ flexShrink: 0, display: 'flex', gap: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  style={iconBtnStyle(i === 0)}
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  style={iconBtnStyle(i === items.length - 1)}
                  aria-label="Move down"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  style={{
                    ...iconBtnStyle(false),
                    color: '#dc2626', backgroundColor: '#fef2f2', borderColor: '#fecaca',
                  }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div role="alert" style={{
          padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '5px',
          color: '#991b1b', fontSize: '0.8rem', marginBottom: '0.75rem',
        }}>
          {saveError}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        style={{
          width: '100%', padding: '0.65rem 1.25rem',
          backgroundColor: isSaving ? '#93c5fd' : '#1d4ed8',
          color: '#fff', border: 'none', borderRadius: '6px',
          fontSize: '0.9rem', fontWeight: 600,
          cursor: isSaving ? 'not-allowed' : 'pointer',
        }}
      >
        {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Save playlist'}
      </button>
    </div>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEdit = !!id && id !== 'new';

  /* ---- Form state ---- */
  const [name, setName] = useState('');
  const [orderingRule, setOrderingRule] = useState<OrderingRule>('sequential');
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit); // new mode is immediately ready

  /* ---- Load playlist for edit mode ---- */
  const { data: existingPlaylist, isLoading: playlistLoading, isError: playlistError } =
    useQuery<NamedPlaylist>({
      queryKey: ['named-playlist', id],
      queryFn: () => api.get<NamedPlaylist>(`/named_playlists/${id}`),
      enabled: isEdit,
    });

  /* Hydrate form when edit data arrives */
  useEffect(() => {
    if (existingPlaylist && !hydrated) {
      setName(existingPlaylist.name);
      setOrderingRule(existingPlaylist.ordering_rule);
      setItems(existingPlaylist.items);
      setHydrated(true);
    }
  }, [existingPlaylist, hydrated]);

  /* ---- Load available cards ---- */
  const { data: availableCards = [], isLoading: cardsLoading, isError: cardsError } =
    useQuery<ContentItem[]>({
      queryKey: ['content'],
      queryFn: () => api.get<ContentItem[]>('/content'),
      staleTime: 30_000,
    });

  /* ---- Save mutation ---- */
  const { mutate: save, isPending: isSaving, error: saveErr } = useMutation({
    mutationFn: (payload: { name: string; ordering_rule: OrderingRule; items: { content_id: string; duration_seconds: number }[] }) =>
      isEdit
        ? api.put<NamedPlaylist>(`/named_playlists/${id}`, payload)
        : api.post<NamedPlaylist>('/named_playlists', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['named-playlists'] });
      navigate('/playlists');
    },
  });

  /* ---- Add card from picker ---- */
  const addedIds = new Set(items.map((i) => i.content_id));

  function addCard(card: ContentItem): void {
    if (addedIds.has(card.id)) return;
    setItems((prev) => [
      ...prev,
      { content_id: card.id, duration_seconds: 10, card: { id: card.id, template_type: card.template_type, data: card.data } },
    ]);
  }

  /* ---- Submit ---- */
  function handleSave(): void {
    if (!name.trim()) { setValidationError('Playlist name is required.'); return; }
    if (name.length > 120) { setValidationError('Name exceeds 120 characters.'); return; }
    if (items.length === 0) { setValidationError('Add at least one card to the playlist.'); return; }
    setValidationError(null);
    save({
      name: name.trim(),
      ordering_rule: orderingRule,
      items: items.map(({ content_id, duration_seconds }) => ({ content_id, duration_seconds })),
    });
  }

  /* ---- Loading / error state (edit mode only) ---- */
  if (isEdit && playlistLoading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Link to="/playlists" style={backLinkStyle}>← Playlists</Link>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading playlist…</p>
      </div>
    );
  }

  if (isEdit && playlistError) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Link to="/playlists" style={backLinkStyle}>← Playlists</Link>
        <div role="alert" style={{
          marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.875rem',
        }}>
          Failed to load playlist.
        </div>
      </div>
    );
  }

  const combinedError = validationError ?? (saveErr instanceof Error ? `Save failed: ${saveErr.message}` : null);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/playlists" style={backLinkStyle}>← Playlists</Link>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
          {isEdit ? `Edit: ${existingPlaylist?.name ?? '…'}` : 'New playlist'}
        </h1>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left: card picker (40%) */}
        <div style={{
          width: '40%', flexShrink: 0,
          border: '1px solid #e5e7eb', borderRadius: '8px',
          padding: '1rem', backgroundColor: '#fafafa',
          maxHeight: 'calc(100vh - 220px)', overflowY: 'auto',
        }}>
          <CardPicker
            cards={availableCards}
            isLoading={cardsLoading}
            isError={cardsError}
            addedIds={addedIds}
            onAdd={addCard}
          />
        </div>

        {/* Right: editor (60%) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <PlaylistEditor
            name={name}
            onNameChange={setName}
            orderingRule={orderingRule}
            onOrderingRuleChange={setOrderingRule}
            items={items}
            onItemsChange={setItems}
            onSave={handleSave}
            isSaving={isSaving}
            saveError={combinedError}
            isEdit={isEdit}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Style constants
 * ================================================================== */

const sectionHeading: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const backLinkStyle: React.CSSProperties = {
  fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: '#374151', marginBottom: '0.3rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db', borderRadius: '5px',
  fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif',
  color: '#111827', backgroundColor: '#fff',
};

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.2rem 0.35rem', fontSize: '0.65rem', fontWeight: 700,
    color: disabled ? '#d1d5db' : '#374151',
    backgroundColor: disabled ? '#f9fafb' : '#f3f4f6',
    border: `1px solid ${disabled ? '#e5e7eb' : '#d1d5db'}`,
    borderRadius: '3px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
