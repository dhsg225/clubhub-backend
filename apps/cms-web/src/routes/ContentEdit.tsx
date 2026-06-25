/**
 * Card Edit Form — edit an existing content card.
 * Route: /content/:id/edit
 *
 * Same schema-driven form as ContentNew, but pre-filled with existing card data
 * and PATCHes instead of POSTs.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

/* ================================================================== *
 * Types (same as ContentNew)
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
  sort_order: number;
}

interface ContentItem {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
}

/* ================================================================== *
 * Sub-component types
 * ================================================================== */

interface MenuItem { name: string; price: string; }
interface MenuSection { section_title: string; items: MenuItem[]; }
interface SpecialItem { dish_name: string; price: string; }

const STUB_COLORS: Record<string, string> = {
  promo_slide: '#7C3AED', event_banner: '#EA580C', sponsor_banner: '#16A34A',
  menu_board: '#2563EB', daily_specials: '#DC2626',
};

/* ================================================================== *
 * Validation (same as ContentNew)
 * ================================================================== */

function validateFromSchema(
  fields: SchemaField[], data: Record<string, unknown>, expiresAt: string, noExpiry: boolean,
): string | null {
  if (!noExpiry && !expiresAt) return 'Expiry date is required. Check "No expiry" if this card runs indefinitely.';
  for (const field of fields) {
    const val = data[field.key];
    if (field.type === 'text' || field.type === 'textarea') {
      const str = (val as string) ?? '';
      if (field.required && !str.trim()) return `${field.label} is required.`;
      if (field.max_chars && str.length > field.max_chars) return `${field.label} exceeds ${field.max_chars} characters.`;
    }
    if (field.type === 'select' && field.required && !val) return `${field.label} is required.`;
    if (field.type === 'image' && field.required && !(val as string)?.trim()) return `${field.label} is required.`;
  }
  return null;
}

/* ================================================================== *
 * Form primitives (duplicated from ContentNew to keep this self-contained)
 * ================================================================== */

function FieldLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{children}</label>;
}

function CharCount({ current, max }: { current: number; max: number }): JSX.Element {
  return <span style={{ fontSize: '0.7rem', color: current > max ? '#dc2626' : '#9ca3af', marginTop: '0.15rem', display: 'block' }}>{current}/{max}</span>;
}

function TextField({ value, onChange, maxLength, placeholder, multiline = false }: {
  value: string; onChange: (v: string) => void; maxLength: number; placeholder?: string; multiline?: boolean;
}): JSX.Element {
  const s: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem',
    border: `1px solid ${value.length > maxLength ? '#fca5a5' : '#d1d5db'}`,
    borderRadius: '5px', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', color: '#111827', outline: 'none',
    resize: multiline ? 'vertical' : undefined,
  };
  return (
    <div>
      {multiline
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...s, minHeight: '4.5rem' }} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={s} />}
      <CharCount current={value.length} max={maxLength} />
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ marginBottom: '1rem' }}>{children}</div>;
}

/* ================================================================== *
 * ImageField (same as ContentNew)
 * ================================================================== */

function ImageField({ value, onChange, label, required }: {
  value: string; onChange: (url: string) => void; label: string; required?: boolean | undefined;
}): JSX.Element {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  async function handleFileSelect(file: File): Promise<void> {
    setError(''); setUploading(true);
    try {
      const tokenRes = await api.post<{ upload_url: string; auth_header: { AccessKey: string }; cdn_url: string }>('/media/upload-token', { filename: file.name });
      const putRes = await fetch(tokenRes.upload_url, {
        method: 'PUT',
        headers: { 'AccessKey': tokenRes.auth_header.AccessKey, 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed: HTTP ${putRes.status}`);
      onChange(tokenRes.cdn_url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('501') || msg.includes('not configured')) { setFallbackMode(true); setError('Media storage not configured — paste a URL instead.'); }
      else setError(msg);
    } finally { setUploading(false); }
  }

  if (fallbackMode) {
    return (
      <FieldGroup>
        <FieldLabel>{label}{required ? '' : ' (optional)'}</FieldLabel>
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://example.com/image.jpg" style={inputStyle} />
      </FieldGroup>
    );
  }

  return (
    <FieldGroup>
      <FieldLabel>{label}{required ? '' : ' (optional)'}</FieldLabel>
      {value && (
        <div style={{ marginBottom: '0.5rem', position: 'relative' }}>
          <img src={value} alt="Uploaded" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px', border: '1px solid #e5e7eb', objectFit: 'contain', backgroundColor: '#f9fafb' }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: '4px', right: '4px', padding: '0.15rem 0.4rem', fontSize: '0.7rem', fontWeight: 600, color: '#991b1b', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4" disabled={uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelect(f); }}
        style={{ fontSize: '0.8rem', color: '#374151', opacity: uploading ? 0.5 : 1 }} />
      {uploading && <div style={{ fontSize: '0.78rem', color: '#1d4ed8', marginTop: '0.25rem' }}>Uploading…</div>}
      {error && <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '0.25rem' }}>{error}</div>}
    </FieldGroup>
  );
}

/* ================================================================== *
 * Schema-driven field renderer (same pattern as ContentNew)
 * ================================================================== */

function SchemaFields({ fields, data, onChange }: {
  fields: SchemaField[]; data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void;
}): JSX.Element {
  function updateField(key: string, value: unknown): void { onChange({ ...data, [key]: value }); }

  const rendered: JSX.Element[] = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i]!;
    const nextField = i + 1 < fields.length ? fields[i + 1] : undefined;

    if (field.type === 'color' && nextField && nextField.type === 'color') {
      rendered.push(
        <div key={`${field.key}-${nextField.key}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <FieldLabel>{field.label}</FieldLabel>
            <input type="color" value={(data[field.key] as string) ?? field.default ?? '#000000'} onChange={(e) => updateField(field.key, e.target.value)} style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{(data[field.key] as string) ?? ''}</span>
          </div>
          <div>
            <FieldLabel>{nextField.label}</FieldLabel>
            <input type="color" value={(data[nextField.key] as string) ?? nextField.default ?? '#000000'} onChange={(e) => updateField(nextField.key, e.target.value)} style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{(data[nextField.key] as string) ?? ''}</span>
          </div>
        </div>,
      );
      i += 2; continue;
    }

    switch (field.type) {
      case 'text':
        rendered.push(<FieldGroup key={field.key}><FieldLabel>{field.label}{field.required ? '' : ' (optional)'}</FieldLabel><TextField value={(data[field.key] as string) ?? ''} onChange={(v) => updateField(field.key, v)} maxLength={field.max_chars ?? 100} placeholder={field.label} /></FieldGroup>);
        break;
      case 'textarea':
        rendered.push(<FieldGroup key={field.key}><FieldLabel>{field.label}{field.required ? '' : ' (optional)'}</FieldLabel><TextField value={(data[field.key] as string) ?? ''} onChange={(v) => updateField(field.key, v)} maxLength={field.max_chars ?? 500} placeholder={field.label} multiline /></FieldGroup>);
        break;
      case 'color':
        rendered.push(<FieldGroup key={field.key}><FieldLabel>{field.label}</FieldLabel><input type="color" value={(data[field.key] as string) ?? field.default ?? '#000000'} onChange={(e) => updateField(field.key, e.target.value)} style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} /><span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{(data[field.key] as string) ?? ''}</span></FieldGroup>);
        break;
      case 'select':
        rendered.push(<FieldGroup key={field.key}><FieldLabel>{field.label}</FieldLabel><select value={(data[field.key] as string) ?? field.options?.[0] ?? ''} onChange={(e) => updateField(field.key, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>{(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></FieldGroup>);
        break;
      case 'image':
        rendered.push(<ImageField key={field.key} value={(data[field.key] as string) ?? ''} onChange={(url) => updateField(field.key, url)} label={field.label} required={field.required} />);
        break;
      default:
        break;
    }
    i++;
  }
  return <>{rendered}</>;
}

/* ================================================================== *
 * Live preview (same as ContentNew)
 * ================================================================== */

function LivePreview({ type, data }: { type: string; data: Record<string, unknown> }): JSX.Element {
  const title = (data['title'] as string) || (data['event_name'] as string) || (data['sponsor_name'] as string) || (data['headline'] as string) || type.replace(/_/g, ' ');
  const bg = (data['background_color'] as string) || STUB_COLORS[type] || '#374151';
  const textColor = (data['text_color'] as string) || '#ffffff';
  const bgImage = (data['background_image'] as string) || (data['media_url'] as string) || '';
  const isVideo = bgImage.includes('.mp4');
  const skipKeys = new Set(['title', 'event_name', 'sponsor_name', 'headline', 'background_image', 'media_url', 'media_hash']);
  const entries: [string, string][] = Object.entries(data)
    .filter(([k, v]) => typeof v === 'string' && v.trim() !== '' && !skipKeys.has(k) && !k.includes('color'))
    .map(([k, v]) => [k.replace(/_/g, ' '), v as string]);

  const containerStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, backgroundColor: bg,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...(bgImage && !isVideo ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  };

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
      <div style={containerStyle}>
        {/* Dark overlay for text legibility when background image is present */}
        {bgImage && isVideo && (
          <video src={bgImage} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {bgImage && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />}
        <div style={{ position: 'absolute', top: '5%', left: '5%', fontFamily: 'monospace', fontSize: 'clamp(0.45rem, 1.5vw, 0.7rem)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.65, color: textColor, zIndex: 1 }}>{type}</div>
        <div style={{ color: textColor, fontFamily: 'system-ui, sans-serif', fontSize: 'clamp(1rem, 4.5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4%', textAlign: 'center', lineHeight: 1.1, padding: '0 8%', wordBreak: 'break-word', position: 'relative', zIndex: 1 }}>{title}</div>
        <div style={{ width: '70%', maxWidth: '900px', position: 'relative', zIndex: 1 }}>
          {entries.map(([key, val]) => (
            <div key={key} style={{ display: 'flex', gap: '3%', marginBottom: '2%', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '2%', fontSize: 'clamp(0.5rem, 1.4vw, 0.85rem)', color: textColor }}>
              <span style={{ opacity: 0.55, minWidth: '32%', fontFamily: 'monospace', flexShrink: 0 }}>{key}</span>
              <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch existing card
  const { data: card, isLoading: cardLoading, isError: cardError } = useQuery<ContentItem>({
    queryKey: ['content', id],
    queryFn: () => api.get<ContentItem>(`/content/${id}`),
    enabled: !!id,
  });

  // Fetch template catalogue
  const { data: templates } = useQuery<CardTemplate[]>({
    queryKey: ['card-templates'],
    queryFn: () => api.get<CardTemplate[]>('/card-templates'),
  });

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [expiresAt, setExpiresAt] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Pre-fill form when card loads
  useEffect(() => {
    if (card && !initialized) {
      setFormData(card.data ?? {});
      if (card.expires_at) {
        setExpiresAt(card.expires_at.slice(0, 10)); // YYYY-MM-DD
      } else {
        setNoExpiry(true);
      }
      setInitialized(true);
    }
  }, [card, initialized]);

  const currentTemplate = templates?.find((t) => t.type_slug === card?.template_type);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: (payload: { data: Record<string, unknown>; expires_at: string | null }) =>
      api.patch<ContentItem>(`/content/${id}`, payload),
    onSuccess: () => navigate(`/content/${id}`),
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!currentTemplate) return;
    const err = validateFromSchema(currentTemplate.field_schema.fields, formData, expiresAt, noExpiry);
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    save({ data: formData, expires_at: noExpiry ? null : expiresAt || null });
  }

  if (cardLoading) {
    return <Page><p style={{ color: '#6b7280' }}>Loading card...</p></Page>;
  }

  if (cardError || !card) {
    return <Page><div style={errorStyle}>Card not found.</div></Page>;
  }

  return (
    <Page>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={`/content/${id}`} style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>← Back to card</Link>
        <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>Edit card</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          {currentTemplate?.display_name ?? card.template_type} · {card.id.slice(0, 8)}
        </p>
      </div>

      <div className="cms-split-panel" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          {currentTemplate && (
            <SchemaFields fields={currentTemplate.field_schema.fields} data={formData} onChange={setFormData} />
          )}

          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0 1rem' }} />

          {/* Expiry */}
          <FieldGroup>
            <FieldLabel>Expiry date</FieldLabel>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={noExpiry} style={{ ...inputStyle, opacity: noExpiry ? 0.4 : 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={noExpiry} onChange={(e) => { setNoExpiry(e.target.checked); if (e.target.checked) setExpiresAt(''); }} />
              No expiry — runs indefinitely
            </label>
          </FieldGroup>

          {validationError && <div style={errorStyle}>{validationError}</div>}
          {saveError && <div style={errorStyle}>Save failed: {saveError instanceof Error ? saveError.message : String(saveError)}</div>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={isPending} style={{
              padding: '0.65rem 1.25rem', backgroundColor: isPending ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
            }}>
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            <Link to={`/content/${id}`} style={{
              padding: '0.65rem 1.25rem', backgroundColor: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none',
            }}>
              Cancel
            </Link>
          </div>
        </form>

        {/* Preview */}
        <div>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live preview (16:9)</span>
          </div>
          <LivePreview type={card.template_type} data={formData} />
        </div>
      </div>
    </Page>
  );
}

/* ================================================================== *
 * Styles
 * ================================================================== */

function Page({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.875rem',
  fontFamily: 'system-ui, sans-serif', color: '#111827', backgroundColor: '#fff',
};

const errorStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: '5px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem',
};
