/**
 * Template Author — admin-only page for managing the card template catalogue.
 * D-019 L2: Super-Admin UI for the card_templates registry.
 *
 * Route: /templates/author (PLATFORM_ADMIN only)
 *
 * Features:
 * - List all templates with field schemas
 * - Create new template types with field definitions
 * - Edit existing template field schemas
 * - Live form preview showing what operators will see
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client.js';

/* ================================================================== *
 * Types
 * ================================================================== */

interface SchemaField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'select' | 'sections' | 'items' | 'image';
  max_chars?: number;
  required?: boolean;
  default?: string;
  options?: string[];
}

interface CardTemplate {
  type_slug: string;
  display_name: string;
  field_schema: { fields: SchemaField[] };
  tenant_id: string | null;
  sort_order: number;
  created_at: string;
}

const FIELD_TYPES: SchemaField['type'][] = ['text', 'textarea', 'color', 'select', 'sections', 'items', 'image'];

/* ================================================================== *
 * Empty field template
 * ================================================================== */

function emptyField(): SchemaField {
  return { key: '', label: '', type: 'text', required: false };
}

/* ================================================================== *
 * MAIN COMPONENT — Template list + editor
 * ================================================================== */

export function Component(): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CardTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates, isLoading, isError } = useQuery<CardTemplate[]>({
    queryKey: ['card-templates'],
    queryFn: () => api.get<CardTemplate[]>('/card-templates'),
  });

  if (isLoading) {
    return <Page><p style={{ color: '#6b7280' }}>Loading templates...</p></Page>;
  }

  if (isError) {
    return <Page><div style={errorStyle}>Failed to load template catalogue.</div></Page>;
  }

  // Show editor when creating or editing
  if (creating) {
    return (
      <Page>
        <TemplateEditor
          template={null}
          onSave={() => { setCreating(false); queryClient.invalidateQueries({ queryKey: ['card-templates'] }); }}
          onCancel={() => setCreating(false)}
        />
      </Page>
    );
  }

  if (editing) {
    return (
      <Page>
        <TemplateEditor
          template={editing}
          onSave={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ['card-templates'] }); }}
          onCancel={() => setEditing(null)}
        />
      </Page>
    );
  }

  // List view
  return (
    <Page>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>Template Author</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
            Manage the card template catalogue. Changes affect what operators see in the "New campaign" form.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} style={primaryBtnStyle}>
          + New template
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(templates ?? []).map((t) => (
          <TemplateRow key={t.type_slug} template={t} onEdit={() => setEditing(t)} />
        ))}
        {(templates ?? []).length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No templates defined. Create one to get started.</p>
        )}
      </div>
    </Page>
  );
}

/* ================================================================== *
 * Template row in list view
 * ================================================================== */

function TemplateRow({ template, onEdit }: { template: CardTemplate; onEdit: () => void }): JSX.Element {
  const fields = template.field_schema.fields;
  const isSystem = template.tenant_id === null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.875rem 1rem', backgroundColor: '#fff',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>{template.display_name}</span>
          <code style={{ fontSize: '0.72rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
            {template.type_slug}
          </code>
          {isSystem && (
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
              SYSTEM
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
          {fields.map((f) => (
            <span key={f.key} style={{
              fontSize: '0.7rem', fontFamily: 'monospace', padding: '0.1rem 0.35rem',
              backgroundColor: f.required ? '#fef3c7' : '#f3f4f6',
              color: f.required ? '#92400e' : '#6b7280',
              borderRadius: '3px', border: `1px solid ${f.required ? '#fcd34d' : '#e5e7eb'}`,
            }}>
              {f.key}<span style={{ opacity: 0.5 }}>:{f.type}</span>
            </span>
          ))}
        </div>
      </div>
      <button type="button" onClick={onEdit} style={secondaryBtnStyle}>Edit</button>
    </div>
  );
}

/* ================================================================== *
 * Template editor — create or edit
 * ================================================================== */

function TemplateEditor({ template, onSave, onCancel }: {
  template: CardTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}): JSX.Element {
  const isNew = template === null;

  const [slug, setSlug] = useState(template?.type_slug ?? '');
  const [displayName, setDisplayName] = useState(template?.display_name ?? '');
  const [sortOrder, setSortOrder] = useState(template?.sort_order ?? 0);
  const [fields, setFields] = useState<SchemaField[]>(
    template?.field_schema.fields ?? [emptyField()],
  );
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post<CardTemplate>('/card-templates', payload),
    onSuccess: onSave,
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: unknown) => api.put<CardTemplate>(`/card-templates/${template!.type_slug}`, payload),
    onSuccess: onSave,
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError('');

    // Validate
    if (!slug.trim()) { setError('Type slug is required'); return; }
    if (!/^[a-z0-9_]+$/.test(slug)) { setError('Slug must be lowercase letters, numbers, underscores only'); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }
    if (fields.length === 0) { setError('At least one field is required'); return; }
    for (const f of fields) {
      if (!f.key.trim()) { setError('All fields must have a key'); return; }
      if (!f.label.trim()) { setError('All fields must have a label'); return; }
      if (!/^[a-z0-9_]+$/.test(f.key)) { setError(`Field key "${f.key}" must be lowercase letters, numbers, underscores`); return; }
    }

    // Check for duplicate keys
    const keys = new Set<string>();
    for (const f of fields) {
      if (keys.has(f.key)) { setError(`Duplicate field key: "${f.key}"`); return; }
      keys.add(f.key);
    }

    const field_schema = {
      fields: fields.map((f) => {
        const clean: SchemaField = { key: f.key.trim(), label: f.label.trim(), type: f.type };
        if (f.required) clean.required = true;
        if (f.max_chars && f.max_chars > 0) clean.max_chars = f.max_chars;
        if (f.default) clean.default = f.default;
        if (f.type === 'select' && f.options && f.options.length > 0) {
          clean.options = f.options.filter((o) => o.trim());
        }
        return clean;
      }),
    };

    if (isNew) {
      createMutation.mutate({ type_slug: slug.trim(), display_name: displayName.trim(), field_schema, sort_order: sortOrder });
    } else {
      updateMutation.mutate({ display_name: displayName.trim(), field_schema, sort_order: sortOrder });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  function updateField(index: number, patch: Partial<SchemaField>): void {
    setFields((prev) => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
  }

  function removeField(index: number): void {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[newIndex]] = [next[newIndex]!, next[index]!];
    setFields(next);
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <button type="button" onClick={onCancel} style={{ fontSize: '0.875rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← Back to list
        </button>
        <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>
          {isNew ? 'New Template' : `Edit: ${template!.display_name}`}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
        {/* Left: form */}
        <form onSubmit={handleSubmit}>
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <Label>Type slug</Label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                disabled={!isNew}
                placeholder="e.g. weekly_special"
                style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }}
              />
            </div>
            <div>
              <Label>Display name</Label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Weekly Special" style={inputStyle} />
            </div>
            <div>
              <Label>Sort order</Label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: '70px' }} />
            </div>
          </div>

          {/* Fields */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <Label>Fields ({fields.length})</Label>
              <button type="button" onClick={() => setFields([...fields, emptyField()])} style={secondaryBtnStyle}>
                + Add field
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fields.map((field, i) => (
                <FieldEditor
                  key={i}
                  field={field}
                  index={i}
                  total={fields.length}
                  onChange={(patch) => updateField(i, patch)}
                  onRemove={() => removeField(i)}
                  onMove={(dir) => moveField(i, dir)}
                />
              ))}
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" disabled={isPending} style={primaryBtnStyle}>
              {isPending ? 'Saving...' : isNew ? 'Create template' : 'Save changes'}
            </button>
            <button type="button" onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          </div>
        </form>

        {/* Right: preview */}
        <div>
          <Label>Form preview</Label>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9fafb', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What operators will see
            </div>
            {fields.filter((f) => f.key && f.label).map((f) => (
              <div key={f.key} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.2rem' }}>
                  {f.label}{f.required ? '' : ' (optional)'}
                </div>
                {f.type === 'text' && (
                  <div style={{ ...previewInputStyle }}>
                    <span style={{ color: '#9ca3af' }}>{f.label}...</span>
                    {f.max_chars && <span style={{ fontSize: '0.65rem', color: '#9ca3af', float: 'right' }}>0/{f.max_chars}</span>}
                  </div>
                )}
                {f.type === 'textarea' && (
                  <div style={{ ...previewInputStyle, minHeight: '3rem' }}>
                    <span style={{ color: '#9ca3af' }}>{f.label}...</span>
                  </div>
                )}
                {f.type === 'color' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ width: '2rem', height: '1.5rem', borderRadius: '3px', backgroundColor: f.default ?? '#1a1a2e', border: '1px solid #d1d5db' }} />
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{f.default ?? '#1a1a2e'}</span>
                  </div>
                )}
                {f.type === 'select' && (
                  <div style={previewInputStyle}>
                    <span style={{ color: '#9ca3af' }}>{f.options?.[0] ?? 'Select...'} ▾</span>
                  </div>
                )}
                {f.type === 'image' && (
                  <div style={{ ...previewInputStyle, color: '#9ca3af' }}>Choose file...</div>
                )}
                {f.type === 'sections' && (
                  <div style={{ ...previewInputStyle, color: '#6b7280', fontSize: '0.72rem' }}>Menu board editor</div>
                )}
                {f.type === 'items' && (
                  <div style={{ ...previewInputStyle, color: '#6b7280', fontSize: '0.72rem' }}>Items list editor</div>
                )}
              </div>
            ))}
            {fields.filter((f) => f.key && f.label).length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>Add fields to see preview</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Field editor row
 * ================================================================== */

function FieldEditor({ field, index, total, onChange, onRemove, onMove }: {
  field: SchemaField;
  index: number;
  total: number;
  onChange: (patch: Partial<SchemaField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}): JSX.Element {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.625rem 0.75rem', backgroundColor: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <input
          value={field.key}
          onChange={(e) => onChange({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          placeholder="field_key"
          style={{ ...inputStyle, fontSize: '0.8rem', fontFamily: 'monospace' }}
        />
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field Label"
          style={{ ...inputStyle, fontSize: '0.8rem' }}
        />
        <select value={field.type} onChange={(e) => onChange({ type: e.target.value as SchemaField['type'] })} style={{ ...inputStyle, fontSize: '0.8rem', width: '100px' }}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={tinyBtnStyle} title="Move up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} style={tinyBtnStyle} title="Move down">↓</button>
          <button type="button" onClick={onRemove} style={{ ...tinyBtnStyle, color: '#dc2626' }} title="Remove">✕</button>
        </div>
      </div>

      {/* Options row */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer' }}>
          <input type="checkbox" checked={field.required ?? false} onChange={(e) => onChange({ required: e.target.checked })} />
          Required
        </label>

        {(field.type === 'text' || field.type === 'textarea') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Max chars:
            <input
              type="number"
              value={field.max_chars ?? ''}
              onChange={(e) => { const v = parseInt(e.target.value); onChange(v > 0 ? { max_chars: v } : { max_chars: 0 }); }}
              placeholder="none"
              style={{ ...inputStyle, width: '60px', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
            />
          </label>
        )}

        {field.type === 'color' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Default:
            <input
              type="color"
              value={field.default ?? '#1a1a2e'}
              onChange={(e) => onChange({ default: e.target.value })}
              style={{ width: '2rem', height: '1.5rem', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer' }}
            />
          </label>
        )}

        {field.type === 'select' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Options:
            <input
              value={(field.options ?? []).join(', ')}
              onChange={(e) => onChange({ options: e.target.value.split(',').map((s) => s.trim()) })}
              placeholder="Option1, Option2, ..."
              style={{ ...inputStyle, fontSize: '0.75rem', padding: '0.2rem 0.4rem', width: '180px' }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Shared components + styles
 * ================================================================== */

function Page({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827', maxWidth: '1000px' }}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.2rem' }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '5px',
  fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', color: '#111827', backgroundColor: '#fff',
};

const previewInputStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '4px',
  fontSize: '0.78rem', backgroundColor: '#fff',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', backgroundColor: '#1d4ed8', color: '#fff',
  border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '0.35rem 0.7rem', backgroundColor: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.8rem', cursor: 'pointer',
};

const tinyBtnStyle: React.CSSProperties = {
  padding: '0.15rem 0.35rem', backgroundColor: '#f3f4f6', color: '#6b7280',
  border: '1px solid #e5e7eb', borderRadius: '3px', fontSize: '0.75rem', cursor: 'pointer',
  lineHeight: 1,
};

const errorStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: '5px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem',
};
