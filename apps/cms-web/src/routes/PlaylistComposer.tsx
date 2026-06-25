/**
 * Playlist Composer — create or edit a named playlist.
 * Routes: /playlists/new (create) and /playlists/:id (edit)
 *
 * Single-column layout: header → settings → [+ Add cards] drawer → timeline → card list → save.
 * The "Add cards" panel opens as a stamp grid overlay — click a stamp to add it to the playlist.
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

/** Tiny 16:9 preview stamp */
function CardStamp({ card, size = 'md' }: {
  card: { template_type: string; data: Record<string, unknown> | null };
  size?: 'sm' | 'md';
}): JSX.Element {
  const d = card.data ?? {};
  const bg = (d.background_color as string) || BADGE_COLORS[card.template_type] || '#374151';
  const textColor = (d.text_color as string) || '#ffffff';
  const title = cardTitle(card);
  const w = size === 'sm' ? '48px' : '56px';
  const h = size === 'sm' ? '27px' : '32px';
  const fs = size === 'sm' ? '0.35rem' : '0.4rem';

  return (
    <div style={{
      width: w, height: h, flexShrink: 0,
      borderRadius: '3px', overflow: 'hidden',
      backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid rgba(0,0,0,0.1)',
    }}>
      <span style={{
        color: textColor, fontSize: fs, fontWeight: 700,
        textAlign: 'center', lineHeight: 1.15,
        padding: '0 2px', overflow: 'hidden', maxHeight: '100%',
        wordBreak: 'break-word',
      }}>
        {title.length > 20 ? title.slice(0, 18) + '…' : title}
      </span>
    </div>
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
 * Add Cards drawer — stamp grid overlay
 * ================================================================== */

function AddCardsDrawer({
  cards, isLoading, isError, addedIds, onAdd, onClose,
}: {
  cards: ContentItem[];
  isLoading: boolean;
  isError: boolean;
  addedIds: Set<string>;
  onAdd: (card: ContentItem) => void;
  onClose: () => void;
}): JSX.Element {
  const available = cards.filter((c) => !addedIds.has(c.id));
  const alreadyAdded = cards.filter((c) => addedIds.has(c.id));

  return (
    <div style={{
      border: '1px solid #bfdbfe', borderRadius: '8px',
      backgroundColor: '#f0f7ff', padding: '1rem', marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
          Add cards to playlist
        </span>
        <button type="button" onClick={onClose} style={{
          padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 600,
          color: '#6b7280', backgroundColor: '#fff', border: '1px solid #d1d5db',
          borderRadius: '4px', cursor: 'pointer',
        }}>
          Done
        </button>
      </div>

      {isLoading && <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Loading cards…</p>}
      {isError && <p style={{ color: '#991b1b', fontSize: '0.8rem' }}>Failed to load cards</p>}

      {!isLoading && !isError && cards.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
          No cards yet. <Link to="/content/new" style={{ color: '#1d4ed8' }}>Create a card</Link> first.
        </p>
      )}

      {/* Available cards — stamp grid */}
      {available.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {available.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onAdd(card)}
              title={`Add: ${cardTitle(card)}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: '6px',
                backgroundColor: '#fff', cursor: 'pointer', width: '80px',
                transition: 'border-color 0.15s',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; }}
            >
              <CardStamp card={card} size="sm" />
              <span style={{
                fontSize: '0.6rem', color: '#374151', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                width: '100%', textAlign: 'center',
              }}>
                {cardTitle(card)}
              </span>
              <span style={{ fontSize: '0.55rem', color: BADGE_COLORS[card.template_type] ?? '#6b7280', fontWeight: 600 }}>
                {card.template_type.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Already-added section (muted) */}
      {alreadyAdded.length > 0 && available.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #dbeafe' }}>
          <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Already in playlist
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem', opacity: 0.4 }}>
            {alreadyAdded.map((card) => (
              <div key={card.id} style={{ width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                <CardStamp card={card} size="sm" />
                <span style={{ fontSize: '0.55rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                  {cardTitle(card)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 && alreadyAdded.length > 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
          All cards are already in the playlist.
        </p>
      )}
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
  const [hydrated, setHydrated] = useState(!isEdit);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Drag state */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  /* ---- Load playlist for edit mode ---- */
  const { data: existingPlaylist, isLoading: playlistLoading, isError: playlistError } =
    useQuery<NamedPlaylist>({
      queryKey: ['named-playlist', id],
      queryFn: () => api.get<NamedPlaylist>(`/named_playlists/${id}`),
      enabled: isEdit,
    });

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

  /* ---- Actions ---- */
  const addedIds = new Set(items.map((i) => i.content_id));

  function addCard(card: ContentItem): void {
    if (addedIds.has(card.id)) return;
    setItems((prev) => [
      ...prev,
      { content_id: card.id, duration_seconds: 10, card: { id: card.id, template_type: card.template_type, data: card.data } },
    ]);
  }

  function move(index: number, direction: -1 | 1): void {
    const next = [...items];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[swap]!;
    next[swap] = tmp;
    setItems(next);
  }

  function remove(index: number): void {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateDuration(index: number, value: string): void {
    const secs = Math.max(5, Math.min(300, parseInt(value, 10) || 10));
    setItems(items.map((it, i) => i === index ? { ...it, duration_seconds: secs } : it));
  }

  function handleDragStart(index: number): void { setDragIndex(index); }
  function handleDragOver(e: React.DragEvent, index: number): void { e.preventDefault(); setDragOverIndex(index); }
  function handleDrop(index: number): void {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return; }
    const next = [...items];
    const [dragged] = next.splice(dragIndex, 1);
    if (dragged) next.splice(index, 0, dragged);
    setItems(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleDragEnd(): void { setDragIndex(null); setDragOverIndex(null); }

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

  /* ---- Time metrics ---- */
  const totalSeconds = items.reduce((sum, it) => sum + it.duration_seconds, 0);
  const totalMinSec = totalSeconds >= 60
    ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
    : `${totalSeconds}s`;

  /* ---- Loading / error ---- */
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
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <Link to="/playlists" style={backLinkStyle}>← Playlists</Link>
          <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            {isEdit ? `Edit: ${existingPlaylist?.name ?? '…'}` : 'New playlist'}
          </h1>
        </div>
        {isEdit && id && (
          <button
            type="button"
            onClick={() => window.open(`/preview/playlist/${id}`, '_blank', 'width=1280,height=720')}
            style={{
              padding: '0.5rem 1rem', borderRadius: '6px',
              border: '1px solid #d1d5db', backgroundColor: '#fff',
              color: '#374151', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', marginTop: '1.5rem',
            }}
          >
            ▶ Preview
          </button>
        )}
      </div>

      {/* Settings row — name + ordering side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginBottom: '1.25rem', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Playlist name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            maxLength={120} placeholder="e.g. Evening Bar Loop" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Ordering</label>
          <select value={orderingRule} onChange={(e) => setOrderingRule(e.target.value as OrderingRule)}
            style={{ ...inputStyle, cursor: 'pointer', width: '200px' }}>
            <option value="sequential">Sequential</option>
            <option value="shuffle">Shuffle</option>
          </select>
        </div>
      </div>

      {/* Add cards button / drawer */}
      {!drawerOpen ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={{
            width: '100%', padding: '0.6rem', marginBottom: '1rem',
            border: '2px dashed #bfdbfe', borderRadius: '8px',
            backgroundColor: '#f8faff', color: '#1d4ed8',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}
        >
          + Add cards
          {availableCards.length > 0 && (
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 400 }}>
              ({availableCards.length - addedIds.size} available)
            </span>
          )}
        </button>
      ) : (
        <AddCardsDrawer
          cards={availableCards}
          isLoading={cardsLoading}
          isError={cardsError}
          addedIds={addedIds}
          onAdd={addCard}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Timeline header */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {items.length} {items.length === 1 ? 'card' : 'cards'} in playlist
          </span>
          {items.length > 0 && (
            <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
              Loop: <strong>{totalMinSec}</strong>
            </span>
          )}
        </div>
        {items.length > 0 && totalSeconds > 0 && (
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '0.4rem', gap: '1px' }}>
            {items.map((item) => {
              const pct = (item.duration_seconds / totalSeconds) * 100;
              const color = item.card ? (BADGE_COLORS[item.card.template_type] ?? '#6b7280') : '#6b7280';
              return (
                <div
                  key={item.content_id}
                  title={`${item.card ? cardTitle(item.card) : item.content_id}: ${item.duration_seconds}s (${pct.toFixed(0)}%)`}
                  style={{ width: `${pct}%`, minWidth: '3px', backgroundColor: color, borderRadius: '1px' }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Card list */}
      {items.length === 0 && (
        <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem', marginBottom: '1rem' }}>
          No cards yet — click "+ Add cards" above.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem' }}>
        {items.map((item, i) => {
          const pct = totalSeconds > 0 ? ((item.duration_seconds / totalSeconds) * 100).toFixed(0) : '0';
          const isDragOver = dragOverIndex === i && dragIndex !== i;
          return (
            <div
              key={item.content_id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px',
                backgroundColor: dragIndex === i ? '#f0f9ff' : '#fff',
                borderTopColor: isDragOver ? '#3b82f6' : '#e5e7eb',
                borderTopWidth: isDragOver ? '2px' : '1px',
                cursor: 'grab',
              }}
            >
              {/* Position */}
              <span style={{
                flexShrink: 0, width: '1.4rem', height: '1.4rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af',
                backgroundColor: '#f3f4f6', borderRadius: '4px',
              }}>
                {i + 1}
              </span>

              {/* Stamp + info */}
              {item.card && <CardStamp card={item.card} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: '0.8rem', fontWeight: 500, color: '#111827',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                }}>
                  {item.card ? cardTitle(item.card) : item.content_id}
                </span>
                {item.card && <TemplateBadge type={item.card.template_type} />}
              </div>

              {/* Duration + % */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <input
                  type="number" min={5} max={300}
                  value={item.duration_seconds}
                  onChange={(e) => updateDuration(i, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '44px', padding: '0.2rem 0.25rem',
                    border: '1px solid #d1d5db', borderRadius: '4px',
                    fontSize: '0.75rem', textAlign: 'right', fontFamily: 'system-ui',
                  }}
                />
                <span style={{ fontSize: '0.6rem', color: '#9ca3af', width: '32px' }}>s ({pct}%)</span>
              </div>

              {/* Reorder + remove */}
              <div style={{ flexShrink: 0, display: 'flex', gap: '0.15rem' }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  style={iconBtnStyle(i === 0)} aria-label="Move up">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                  style={iconBtnStyle(i === items.length - 1)} aria-label="Move down">▼</button>
                <button type="button" onClick={() => remove(i)}
                  style={{ ...iconBtnStyle(false), color: '#dc2626', backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
                  aria-label="Remove">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {combinedError && (
        <div role="alert" style={{
          padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '5px',
          color: '#991b1b', fontSize: '0.8rem', marginBottom: '0.75rem',
        }}>
          {combinedError}
        </div>
      )}

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
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
 * Styles
 * ================================================================== */

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
    padding: '0.2rem 0.3rem', fontSize: '0.6rem', fontWeight: 700,
    color: disabled ? '#d1d5db' : '#374151',
    backgroundColor: disabled ? '#f9fafb' : '#f3f4f6',
    border: `1px solid ${disabled ? '#e5e7eb' : '#d1d5db'}`,
    borderRadius: '3px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
