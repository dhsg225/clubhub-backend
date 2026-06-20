/**
 * Ticker Manager — operator UI for authoring ticker text items per screen.
 * Route: /ticker
 *
 * Operators select a screen, then manage a list of scrolling text strings.
 * Changes take effect on the next /resolve poll (no restart needed).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

interface Screen {
  id: string;
  name: string | null;
  venue_id: string;
}

interface TickerItem {
  id: string;
  screen_id: string;
  text: string;
  display_order: number;
  active: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

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
  padding: '0.65rem 0.75rem',
  verticalAlign: 'middle',
};

/* ------------------------------------------------------------------ *
 * Main component
 * ------------------------------------------------------------------ */

export function Component(): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [newText, setNewText] = useState('');
  const [addError, setAddError] = useState('');

  // Load screens for selector
  const { data: screens } = useQuery<Screen[]>({
    queryKey: ['screens-all'],
    queryFn: () => api.get<Screen[]>('/screens'),
  });

  // Load ticker items for selected screen
  const {
    data: items,
    isLoading,
    isError,
  } = useQuery<TickerItem[]>({
    queryKey: ['ticker', selectedScreenId],
    queryFn: () => api.get<TickerItem[]>(`/ticker?screen_id=${selectedScreenId}`),
    enabled: !!selectedScreenId,
  });

  // Mutations
  const { mutate: addItem, isPending: addPending } = useMutation({
    mutationFn: (text: string) =>
      api.post<TickerItem>('/ticker', { screen_id: selectedScreenId, text, display_order: (items?.length ?? 0) }),
    onSuccess: () => {
      setNewText('');
      setAddError('');
      void queryClient.invalidateQueries({ queryKey: ['ticker', selectedScreenId] });
    },
    onError: (err) => setAddError(err instanceof Error ? err.message : 'Add failed'),
  });

  const { mutate: patchItem } = useMutation({
    mutationFn: ({ id, ...body }: { id: string; active?: boolean; text?: string; display_order?: number }) =>
      api.patch<TickerItem>(`/ticker/${id}`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ticker', selectedScreenId] }),
  });

  const { mutate: deleteItem } = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/ticker/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ticker', selectedScreenId] }),
  });

  function handleAdd(): void {
    const trimmed = newText.trim();
    if (!trimmed) { setAddError('Text is required'); return; }
    if (trimmed.length > 280) { setAddError('Max 280 characters'); return; }
    if (!selectedScreenId) { setAddError('Select a screen first'); return; }
    addItem(trimmed);
  }

  function handleMoveUp(item: TickerItem, index: number): void {
    if (index === 0 || !items) return;
    const prev = items[index - 1];
    if (!prev) return;
    patchItem({ id: item.id, display_order: prev.display_order - 1 });
  }

  function handleMoveDown(item: TickerItem, index: number): void {
    if (!items || index >= items.length - 1) return;
    const next = items[index + 1];
    if (!next) return;
    patchItem({ id: item.id, display_order: next.display_order + 1 });
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 0.375rem', fontSize: '1.5rem', fontWeight: 600 }}>Ticker</h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
        Manage scrolling text for each screen. Items play in display order when the screen uses a <code>news_bar</code> or <code>split_horizontal</code> layout.
      </p>

      {/* Screen selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
          Screen
        </label>
        <select
          value={selectedScreenId}
          onChange={(e) => setSelectedScreenId(e.target.value)}
          style={{
            fontSize: '0.875rem', padding: '0.45rem 0.6rem',
            border: '1px solid #d1d5db', borderRadius: '6px',
            color: '#111827', backgroundColor: '#fff',
            fontFamily: 'system-ui, sans-serif', minWidth: '260px',
          }}
        >
          <option value="">— Select a screen —</option>
          {(screens ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.id}
            </option>
          ))}
        </select>
      </div>

      {!selectedScreenId && (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Select a screen above to manage its ticker items.</p>
      )}

      {selectedScreenId && (
        <>
          {/* Add item */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeading}>Add item</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter ticker text (max 280 chars)…"
                  maxLength={280}
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    fontSize: '0.875rem', padding: '0.5rem 0.65rem',
                    border: '1px solid #d1d5db', borderRadius: '6px',
                    color: '#111827', resize: 'vertical',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                  {newText.length}/280
                </div>
              </div>
              <button
                onClick={handleAdd}
                disabled={addPending || !newText.trim()}
                style={{
                  padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: '6px', fontSize: '0.875rem',
                  fontWeight: 600, cursor: addPending ? 'not-allowed' : 'pointer',
                  opacity: addPending ? 0.7 : 1, alignSelf: 'flex-start', marginTop: '0',
                }}
              >
                {addPending ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addError && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#991b1b' }}>{addError}</div>
            )}
          </section>

          {/* Items list */}
          <section>
            <h2 style={sectionHeading}>Items ({items?.length ?? 0})</h2>

            {isLoading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>}
            {isError && (
              <div role="alert" style={{
                padding: '0.75rem 1rem', backgroundColor: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.875rem',
              }}>
                Failed to load ticker items.
              </div>
            )}

            {!isLoading && !isError && (items?.length ?? 0) === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No ticker items yet — add one above.</p>
            )}

            {!isLoading && !isError && (items?.length ?? 0) > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ ...thStyle, width: '40px' }}>#</th>
                      <th style={thStyle}>Text</th>
                      <th style={{ ...thStyle, width: '80px' }}>Active</th>
                      <th style={{ ...thStyle, width: '80px' }}>Order</th>
                      <th style={{ ...thStyle, width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items?.map((item, index) => (
                      <TickerRow
                        key={item.id}
                        item={item}
                        index={index}
                        total={items.length}
                        onToggle={(id, active) => patchItem({ id, active })}
                        onMoveUp={() => handleMoveUp(item, index)}
                        onMoveDown={() => handleMoveDown(item, index)}
                        onDelete={(id) => {
                          if (window.confirm('Delete this ticker item?')) deleteItem(id);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * TickerRow
 * ------------------------------------------------------------------ */

function TickerRow({
  item, index, total,
  onToggle, onMoveUp, onMoveDown, onDelete,
}: {
  item: TickerItem;
  index: number;
  total: number;
  onToggle: (id: string, active: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ ...tdStyle, color: '#9ca3af', fontSize: '0.78rem', textAlign: 'center' }}>
        {index + 1}
      </td>
      <td style={tdStyle}>
        <span style={{ color: item.active ? '#111827' : '#9ca3af', fontStyle: item.active ? 'normal' : 'italic' }}>
          {item.text}
        </span>
        <div style={{ fontSize: '0.7rem', color: '#d1d5db', marginTop: '0.15rem' }}>
          {item.text.length}/280
        </div>
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={item.active}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          title={item.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
        />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
            style={orderBtnStyle(index === 0)}
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={index >= total - 1}
            title="Move down"
            style={orderBtnStyle(index >= total - 1)}
          >▼</button>
        </div>
      </td>
      <td style={tdStyle}>
        <button
          onClick={() => onDelete(item.id)}
          style={{
            padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 600,
            color: '#991b1b', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function orderBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.15rem 0.35rem', fontSize: '0.7rem',
    border: '1px solid #d1d5db', borderRadius: '3px',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    backgroundColor: '#fff', color: '#374151',
  };
}

const sectionHeading: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
