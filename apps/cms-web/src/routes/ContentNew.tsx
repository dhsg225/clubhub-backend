/**
 * Card Authoring Form — create a new content card.
 * Route: /content/new
 *
 * BL-040 / D-019 L2+L3: Template catalogue is API-driven.
 * Form fields are auto-generated from field_schema fetched via GET /card-templates.
 * Complex field types (sections, items) delegate to dedicated sub-components.
 *
 * POSTs to POST /content with { template_type, data, expires_at }.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

/* ================================================================== *
 * Types for the card_templates API (L2 catalogue)
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

/* ================================================================== *
 * Sub-component types for complex fields
 * ================================================================== */

interface MenuItem { name: string; price: string; }
interface MenuSection { section_title: string; items: MenuItem[]; }

interface SpecialItem { dish_name: string; price: string; }

const STUB_COLORS: Record<string, string> = {
  promo_slide:    '#7C3AED',
  event_banner:   '#EA580C',
  sponsor_banner: '#16A34A',
  menu_board:     '#2563EB',
  daily_specials: '#DC2626',
};

/* ================================================================== *
 * Derive default form data from field_schema
 * ================================================================== */

function defaultDataFromSchema(fields: SchemaField[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.type) {
      case 'text':
      case 'textarea':
        data[field.key] = field.default ?? '';
        break;
      case 'color':
        data[field.key] = field.default ?? '#1a1a2e';
        break;
      case 'select':
        data[field.key] = field.default ?? field.options?.[0] ?? '';
        break;
      case 'sections':
        data[field.key] = [{ section_title: '', items: [{ name: '', price: '' }] }];
        break;
      case 'items':
        data[field.key] = [{ dish_name: '', price: '' }];
        break;
      case 'image':
        data[field.key] = '';
        break;
    }
  }
  return data;
}

/* ================================================================== *
 * Schema-driven validation
 * ================================================================== */

function validateFromSchema(
  fields: SchemaField[],
  data: Record<string, unknown>,
  expiresAt: string,
  noExpiry: boolean,
): string | null {
  if (!noExpiry && !expiresAt) {
    return 'Expiry date is required. Check "No expiry" if this card runs indefinitely.';
  }

  for (const field of fields) {
    const val = data[field.key];

    if (field.type === 'text' || field.type === 'textarea') {
      const str = (val as string) ?? '';
      if (field.required && !str.trim()) return `${field.label} is required.`;
      if (field.max_chars && str.length > field.max_chars) {
        return `${field.label} exceeds ${field.max_chars} characters.`;
      }
    }

    if (field.type === 'select' && field.required && !val) {
      return `${field.label} is required.`;
    }

    if (field.type === 'image' && field.required && !(val as string)?.trim()) {
      return `${field.label} is required.`;
    }

    // sections and items have their own internal constraints checked by sub-components
    if (field.type === 'sections') {
      const sections = val as MenuSection[] | undefined;
      if (sections) {
        for (const s of sections) {
          if (s.section_title.length > 30) return 'Section title exceeds 30 characters.';
          for (const item of s.items) {
            if (item.name.length > 30) return 'Menu item name exceeds 30 characters.';
            if (item.price.length > 10) return 'Menu item price exceeds 10 characters.';
          }
        }
      }
    }
    if (field.type === 'items') {
      const items = val as SpecialItem[] | undefined;
      if (items) {
        for (const item of items) {
          if (item.dish_name.length > 30) return 'Dish name exceeds 30 characters.';
          if (item.price.length > 10) return 'Price exceeds 10 characters.';
        }
      }
    }
  }

  return null;
}

/* ================================================================== *
 * Form field primitives
 * ================================================================== */

function FieldLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
      {children}
    </label>
  );
}

function CharCount({ current, max }: { current: number; max: number }): JSX.Element {
  const over = current > max;
  return (
    <span style={{ fontSize: '0.7rem', color: over ? '#dc2626' : '#9ca3af', marginTop: '0.15rem', display: 'block' }}>
      {current}/{max}
    </span>
  );
}

function TextField({
  value, onChange, maxLength, placeholder, multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
}): JSX.Element {
  const sharedStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '0.45rem 0.6rem',
    border: `1px solid ${value.length > maxLength ? '#fca5a5' : '#d1d5db'}`,
    borderRadius: '5px', fontSize: '0.875rem',
    fontFamily: 'system-ui, sans-serif', color: '#111827',
    outline: 'none',
    resize: multiline ? 'vertical' : undefined,
  };
  return (
    <div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...sharedStyle, minHeight: '4.5rem' }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle}
        />
      )}
      <CharCount current={value.length} max={maxLength} />
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ marginBottom: '1rem' }}>{children}</div>;
}

/* ================================================================== *
 * Image upload field (BL-044)
 *
 * On file select:
 *   1. POST /media/upload-token → { upload_url, auth_header, cdn_url }
 *   2. PUT file directly to Bunny via upload_url + AccessKey header
 *   3. Store cdn_url in formData[field.key]
 *
 * Fallback: if upload-token returns 501 (Bunny not configured),
 * renders a plain URL text input so operator can paste a URL manually.
 * ================================================================== */

function ImageField({
  value,
  onChange,
  label,
  required,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  required?: boolean | undefined;
}): JSX.Element {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  async function handleFileSelect(file: File): Promise<void> {
    setError('');
    setUploading(true);

    try {
      // Step 1: get upload token
      const tokenRes = await api.post<{
        upload_url: string;
        auth_header: { AccessKey: string };
        cdn_url: string;
      }>('/media/upload-token', { filename: file.name });

      // Step 2: PUT directly to Bunny
      const putRes = await fetch(tokenRes.upload_url, {
        method: 'PUT',
        headers: {
          'AccessKey': tokenRes.auth_header.AccessKey,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed: HTTP ${putRes.status}`);
      }

      // Step 3: store CDN URL
      onChange(tokenRes.cdn_url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('501') || msg.includes('Not Implemented') || msg.includes('not configured')) {
        setFallbackMode(true);
        setError('Media storage not configured — paste a URL instead.');
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
    }
  }

  // Fallback mode: plain URL text input
  if (fallbackMode) {
    return (
      <FieldGroup>
        <FieldLabel>{label}{required ? '' : ' (optional)'}</FieldLabel>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          style={inputStyle}
        />
        <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.15rem', display: 'block' }}>
          Media storage not configured — enter image URL manually
        </span>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup>
      <FieldLabel>{label}{required ? '' : ' (optional)'}</FieldLabel>

      {/* Current image preview */}
      {value && (
        <div style={{ marginBottom: '0.5rem', position: 'relative' }}>
          <img
            src={value}
            alt="Uploaded"
            style={{
              maxWidth: '100%', maxHeight: '120px', borderRadius: '4px',
              border: '1px solid #e5e7eb', objectFit: 'contain',
              backgroundColor: '#f9fafb',
            }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              position: 'absolute', top: '4px', right: '4px',
              padding: '0.15rem 0.4rem', fontSize: '0.7rem', fontWeight: 600,
              color: '#991b1b', backgroundColor: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer',
            }}
          >✕</button>
        </div>
      )}

      {/* File input */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelect(file);
        }}
        style={{
          fontSize: '0.8rem', color: '#374151',
          opacity: uploading ? 0.5 : 1,
        }}
      />

      {uploading && (
        <div style={{ fontSize: '0.78rem', color: '#1d4ed8', marginTop: '0.25rem' }}>
          Uploading…
        </div>
      )}

      {error && (
        <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '0.25rem' }}>
          {error}
        </div>
      )}
    </FieldGroup>
  );
}

/* ================================================================== *
 * Schema-driven field renderer
 * Renders each field from field_schema.fields based on its type.
 * Delegates 'sections' and 'items' to dedicated sub-components.
 * ================================================================== */

function SchemaFields({
  fields,
  data,
  onChange,
}: {
  fields: SchemaField[];
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}): JSX.Element {
  function updateField(key: string, value: unknown): void {
    onChange({ ...data, [key]: value });
  }

  // Group consecutive color fields for side-by-side rendering
  const rendered: JSX.Element[] = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i]!;

    // Check if this is a color field followed by another color field → render side by side
    const nextField = i + 1 < fields.length ? fields[i + 1] : undefined;
    if (field.type === 'color' && nextField && nextField.type === 'color') {
      const next = nextField;
      rendered.push(
        <div key={`${field.key}-${next.key}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <FieldLabel>{field.label}</FieldLabel>
            <input type="color" value={(data[field.key] as string) ?? field.default ?? '#000000'}
              onChange={(e) => updateField(field.key, e.target.value)}
              style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{(data[field.key] as string) ?? ''}</span>
          </div>
          <div>
            <FieldLabel>{next.label}</FieldLabel>
            <input type="color" value={(data[next.key] as string) ?? next.default ?? '#000000'}
              onChange={(e) => updateField(next.key, e.target.value)}
              style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{(data[next.key] as string) ?? ''}</span>
          </div>
        </div>,
      );
      i += 2;
      continue;
    }

    switch (field.type) {
      case 'text':
        rendered.push(
          <FieldGroup key={field.key}>
            <FieldLabel>{field.label}{field.required ? '' : ' (optional)'}</FieldLabel>
            <TextField
              value={(data[field.key] as string) ?? ''}
              onChange={(v) => updateField(field.key, v)}
              maxLength={field.max_chars ?? 100}
              placeholder={field.label}
            />
          </FieldGroup>,
        );
        break;

      case 'textarea':
        rendered.push(
          <FieldGroup key={field.key}>
            <FieldLabel>{field.label}{field.required ? '' : ' (optional)'}</FieldLabel>
            <TextField
              value={(data[field.key] as string) ?? ''}
              onChange={(v) => updateField(field.key, v)}
              maxLength={field.max_chars ?? 500}
              placeholder={field.label}
              multiline
            />
          </FieldGroup>,
        );
        break;

      case 'color':
        rendered.push(
          <FieldGroup key={field.key}>
            <FieldLabel>{field.label}</FieldLabel>
            <input type="color" value={(data[field.key] as string) ?? field.default ?? '#000000'}
              onChange={(e) => updateField(field.key, e.target.value)}
              style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{(data[field.key] as string) ?? ''}</span>
          </FieldGroup>,
        );
        break;

      case 'select':
        rendered.push(
          <FieldGroup key={field.key}>
            <FieldLabel>{field.label}</FieldLabel>
            <select
              value={(data[field.key] as string) ?? field.options?.[0] ?? ''}
              onChange={(e) => updateField(field.key, e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </FieldGroup>,
        );
        break;

      case 'sections':
        rendered.push(
          <MenuBoardFields
            key={field.key}
            data={{ sections: (data[field.key] as MenuSection[]) ?? [{ section_title: '', items: [{ name: '', price: '' }] }] }}
            onChange={(d) => updateField(field.key, d.sections)}
          />,
        );
        break;

      case 'image':
        rendered.push(
          <ImageField
            key={field.key}
            value={(data[field.key] as string) ?? ''}
            onChange={(url) => updateField(field.key, url)}
            label={field.label}
            required={field.required}
          />,
        );
        break;

      case 'items':
        rendered.push(
          <DailySpecialsFields
            key={field.key}
            data={{
              headline: (data['headline'] as string) ?? '',
              items: (data[field.key] as SpecialItem[]) ?? [{ dish_name: '', price: '' }],
            }}
            onChange={(d) => {
              onChange({ ...data, headline: d.headline, [field.key]: d.items });
            }}
          />,
        );
        break;
    }
    i++;
  }

  return <>{rendered}</>;
}

/* ================================================================== *
 * Complex sub-components (sections / items)
 * ================================================================== */

function MenuBoardFields({
  data, onChange,
}: {
  data: { sections: MenuSection[] };
  onChange: (d: { sections: MenuSection[] }) => void;
}): JSX.Element {
  function updateSection(si: number, section: MenuSection): void {
    const sections = data.sections.map((s, i) => (i === si ? section : s));
    onChange({ sections });
  }
  function updateItem(si: number, ii: number, item: MenuItem): void {
    const sections = data.sections.map((s, i) => {
      if (i !== si) return s;
      return { ...s, items: s.items.map((it, j) => (j === ii ? item : it)) };
    });
    onChange({ sections });
  }
  function addSection(): void {
    if (data.sections.length >= 2) return;
    onChange({ sections: [...data.sections, { section_title: '', items: [{ name: '', price: '' }] }] });
  }
  function removeSection(si: number): void {
    onChange({ sections: data.sections.filter((_, i) => i !== si) });
  }
  function addItem(si: number): void {
    if ((data.sections[si]?.items.length ?? 0) >= 4) return;
    const sections = data.sections.map((s, i) =>
      i === si ? { ...s, items: [...s.items, { name: '', price: '' }] } : s,
    );
    onChange({ sections });
  }
  function removeItem(si: number, ii: number): void {
    const sections = data.sections.map((s, i) =>
      i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s,
    );
    onChange({ sections });
  }

  return (
    <>
      {data.sections.map((section, si) => (
        <div key={si} style={{ marginBottom: '1.25rem', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
              Section {si + 1}
            </span>
            {data.sections.length > 1 && (
              <button type="button" onClick={() => removeSection(si)} style={removeBtnStyle}>Remove section</button>
            )}
          </div>
          <FieldGroup>
            <FieldLabel>Section title</FieldLabel>
            <TextField value={section.section_title}
              onChange={(v) => updateSection(si, { ...section, section_title: v })}
              maxLength={30} placeholder="e.g. Mains" />
          </FieldGroup>
          {section.items.map((item, ii) => (
            <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.4rem' }}>
              <div>
                {ii === 0 && <FieldLabel>Item name</FieldLabel>}
                <TextField value={item.name} onChange={(v) => updateItem(si, ii, { ...item, name: v })} maxLength={30} placeholder="Dish name" />
              </div>
              <div style={{ width: '80px' }}>
                {ii === 0 && <FieldLabel>Price</FieldLabel>}
                <TextField value={item.price} onChange={(v) => updateItem(si, ii, { ...item, price: v })} maxLength={10} placeholder="$0.00" />
              </div>
              <div style={{ paddingBottom: ii === 0 ? '1.2rem' : '1.5rem' }}>
                {section.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(si, ii)} style={removeBtnStyle}>✕</button>
                )}
              </div>
            </div>
          ))}
          {section.items.length < 4 && (
            <button type="button" onClick={() => addItem(si)} style={addBtnStyle}>+ Add item</button>
          )}
        </div>
      ))}
      {data.sections.length < 2 && (
        <button type="button" onClick={addSection} style={addBtnStyle}>+ Add section</button>
      )}
    </>
  );
}

function DailySpecialsFields({
  data, onChange,
}: {
  data: { headline: string; items: SpecialItem[] };
  onChange: (d: { headline: string; items: SpecialItem[] }) => void;
}): JSX.Element {
  function updateItem(i: number, item: SpecialItem): void {
    onChange({ ...data, items: data.items.map((it, j) => (j === i ? item : it)) });
  }
  function addItem(): void {
    if (data.items.length >= 5) return;
    onChange({ ...data, items: [...data.items, { dish_name: '', price: '' }] });
  }
  function removeItem(i: number): void {
    onChange({ ...data, items: data.items.filter((_, j) => j !== i) });
  }

  return (
    <>
      <FieldGroup>
        <FieldLabel>Headline</FieldLabel>
        <TextField value={data.headline} onChange={(v) => onChange({ ...data, headline: v })} maxLength={30} placeholder="e.g. Today's Specials" />
      </FieldGroup>
      {data.items.map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.4rem' }}>
          <div>
            {i === 0 && <FieldLabel>Dish name</FieldLabel>}
            <TextField value={item.dish_name} onChange={(v) => updateItem(i, { ...item, dish_name: v })} maxLength={30} placeholder="e.g. Chicken Parma" />
          </div>
          <div style={{ width: '80px' }}>
            {i === 0 && <FieldLabel>Price</FieldLabel>}
            <TextField value={item.price} onChange={(v) => updateItem(i, { ...item, price: v })} maxLength={10} placeholder="$0.00" />
          </div>
          <div style={{ paddingBottom: i === 0 ? '1.2rem' : '1.5rem' }}>
            {data.items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)} style={removeBtnStyle}>✕</button>
            )}
          </div>
        </div>
      ))}
      {data.items.length < 5 && (
        <button type="button" onClick={addItem} style={addBtnStyle}>+ Add item</button>
      )}
    </>
  );
}

/* ================================================================== *
 * Live preview panel
 * ================================================================== */

function LivePreview({ type, data }: { type: string; data: Record<string, unknown> }): JSX.Element {
  // Derive title: try common field names
  const title = (data['title'] as string)
    || (data['event_name'] as string)
    || (data['sponsor_name'] as string)
    || (data['headline'] as string)
    || type.replace(/_/g, ' ');

  const bg = (data['background_color'] as string) || STUB_COLORS[type] || '#374151';
  const textColor = (data['text_color'] as string) || '#ffffff';

  // Collect non-empty string entries for preview (skip color/complex fields)
  const entries: [string, string][] = Object.entries(data)
    .filter(([k, v]) =>
      typeof v === 'string' && v.trim() !== ''
      && k !== 'title' && k !== 'event_name' && k !== 'sponsor_name' && k !== 'headline'
      && !k.includes('color'),
    )
    .map(([k, v]) => [k.replace(/_/g, ' '), v as string]);

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
      <div style={{
        position: 'absolute', inset: 0, backgroundColor: bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '5%', left: '5%',
          fontFamily: 'monospace', fontSize: 'clamp(0.45rem, 1.5vw, 0.7rem)',
          fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          opacity: 0.65, color: textColor,
        }}>{type}</div>
        <div style={{
          position: 'absolute', top: '5%', right: '5%',
          fontFamily: 'monospace', fontSize: 'clamp(0.4rem, 1.2vw, 0.65rem)',
          fontWeight: 700, letterSpacing: '0.2em', opacity: 0.3, color: textColor,
        }}>PREVIEW</div>
        <div style={{
          color: textColor, fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(1rem, 4.5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.02em',
          marginBottom: '4%', textAlign: 'center', lineHeight: 1.1, padding: '0 8%', wordBreak: 'break-word',
        }}>{title}</div>
        <div style={{ width: '70%', maxWidth: '900px' }}>
          {entries.map(([key, val]) => (
            <div key={key} style={{
              display: 'flex', gap: '3%', marginBottom: '2%',
              borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '2%',
              fontSize: 'clamp(0.5rem, 1.4vw, 0.85rem)', color: textColor,
            }}>
              <span style={{ opacity: 0.55, minWidth: '32%', fontFamily: 'monospace', flexShrink: 0 }}>{key}</span>
              <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{val}</span>
            </div>
          ))}
          {entries.length === 0 && (
            <div style={{ color: textColor, opacity: 0.3, fontFamily: 'system-ui', textAlign: 'center', fontSize: 'clamp(0.5rem, 1.2vw, 0.8rem)' }}>
              Fill in fields to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const navigate = useNavigate();

  // Fetch template catalogue from API (BL-040 / D-019 L2)
  const { data: templates, isLoading: templatesLoading, isError: templatesError } = useQuery<CardTemplate[]>({
    queryKey: ['card-templates'],
    queryFn: () => api.get<CardTemplate[]>('/card-templates'),
  });

  const [templateType, setTemplateType] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [expiresAt, setExpiresAt] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [crossPost, setCrossPost] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Auto-select first template when catalogue loads
  useEffect(() => {
    if (templates && templates.length > 0 && !templateType) {
      const first = templates[0]!;
      setTemplateType(first.type_slug);
      setFormData(defaultDataFromSchema(first.field_schema.fields));
    }
  }, [templates, templateType]);

  const currentTemplate = templates?.find((t) => t.type_slug === templateType);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: (payload: { template_type: string; data: Record<string, unknown>; expires_at: string | null; cross_post?: boolean }) =>
      api.post<{ id: string }>('/content', payload),
    onSuccess: () => {
      navigate('/campaigns');
    },
  });

  function handleTemplateChange(slug: string): void {
    const tmpl = templates?.find((t) => t.type_slug === slug);
    if (!tmpl) return;
    setTemplateType(slug);
    setFormData(defaultDataFromSchema(tmpl.field_schema.fields));
    setValidationError(null);
  }

  async function handleAiGenerate(): Promise<void> {
    if (templateType === 'menu_board') return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await api.post<{ fields: Record<string, string> }>('/ai/generate', {
        template_type: templateType,
        context: formData,
      });
      // Merge generated fields — only overwrite empty fields
      const merged = { ...formData };
      for (const [key, value] of Object.entries(result.fields)) {
        const existing = merged[key];
        if (!existing || (typeof existing === 'string' && !existing.trim())) {
          merged[key] = value;
        }
      }
      setFormData(merged);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('501') || msg.includes('not configured')) {
        setAiError('AI generation not configured on this server.');
      } else {
        setAiError(msg);
      }
    } finally {
      setAiGenerating(false);
    }
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!currentTemplate) return;

    const err = validateFromSchema(currentTemplate.field_schema.fields, formData, expiresAt, noExpiry);
    if (err) { setValidationError(err); return; }
    setValidationError(null);

    save({
      template_type: templateType,
      data: formData,
      expires_at: noExpiry ? null : expiresAt || null,
      ...(crossPost ? { cross_post: true } : {}),
    });
  }

  // Loading state
  if (templatesLoading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
        <Link to="/campaigns" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>← Campaigns</Link>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading template catalogue…</p>
      </div>
    );
  }

  if (templatesError || !templates || templates.length === 0) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
        <Link to="/campaigns" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>← Campaigns</Link>
        <div role="alert" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b' }}>
          Failed to load template catalogue. Check that the card_templates table is seeded.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/campaigns" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>← Campaigns</Link>
        <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>New campaign</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          Choose a template, fill in the fields, then save.
        </p>
      </div>

      {/* Split panel */}
      <div className="cms-split-panel" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* ---- LEFT: Form ---- */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Template selector — driven by API */}
          <FieldGroup>
            <FieldLabel>Template type</FieldLabel>
            <select
              value={templateType}
              onChange={(e) => handleTemplateChange(e.target.value)}
              style={{ ...inputStyle, fontWeight: 600 }}
            >
              {templates.map((t) => (
                <option key={t.type_slug} value={t.type_slug}>{t.display_name}</option>
              ))}
            </select>
          </FieldGroup>

          {/* AI generation button — hidden for menu_board */}
          {templateType !== 'menu_board' && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => void handleAiGenerate()}
                disabled={aiGenerating}
                style={{
                  padding: '0.45rem 0.9rem',
                  backgroundColor: aiGenerating ? '#e0e7ff' : '#eef2ff',
                  color: aiGenerating ? '#6366f1' : '#4f46e5',
                  border: '1px solid #c7d2fe', borderRadius: '6px',
                  fontSize: '0.8rem', fontWeight: 600,
                  cursor: aiGenerating ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                }}
              >
                {aiGenerating ? 'Generating…' : 'Write for me ✨'}
              </button>
              {aiError && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#991b1b' }}>{aiError}</div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0 1rem' }} />

          {/* Schema-driven fields */}
          {currentTemplate && (
            <SchemaFields
              fields={currentTemplate.field_schema.fields}
              data={formData}
              onChange={setFormData}
            />
          )}

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0 1rem' }} />

          {/* Expiry */}
          <FieldGroup>
            <FieldLabel>Expiry date</FieldLabel>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={noExpiry}
              style={{ ...inputStyle, opacity: noExpiry ? 0.4 : 1 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={noExpiry} onChange={(e) => { setNoExpiry(e.target.checked); if (e.target.checked) setExpiresAt(''); }} />
              No expiry — runs indefinitely
            </label>
          </FieldGroup>

          {/* Cross-post to social */}
          <FieldGroup>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={crossPost} onChange={(e) => setCrossPost(e.target.checked)} />
              Cross-post to Facebook
            </label>
          </FieldGroup>

          {/* Validation error */}
          {validationError && (
            <div role="alert" style={{ padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '5px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {validationError}
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div role="alert" style={{ padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '5px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Save failed: {saveError instanceof Error ? saveError.message : String(saveError)}
            </div>
          )}

          {/* Save button */}
          <button type="submit" disabled={isPending} style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: isPending ? '#93c5fd' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '0.9rem', fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}>
            {isPending ? 'Saving…' : 'Save campaign'}
          </button>
        </form>

        {/* ---- RIGHT: Live preview ---- */}
        <div>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live preview (16:9)
            </span>
          </div>
          <LivePreview type={templateType} data={formData} />
          <p style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#9ca3af' }}>
            Stub renderer — actual Pi display uses template-specific HTML component
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Shared style constants
 * ================================================================== */

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db', borderRadius: '5px',
  fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif',
  color: '#111827', backgroundColor: '#fff',
};

const addBtnStyle: React.CSSProperties = {
  padding: '0.35rem 0.7rem',
  fontSize: '0.78rem', fontWeight: 600,
  color: '#1d4ed8', backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe', borderRadius: '4px',
  cursor: 'pointer', marginBottom: '0.5rem',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.4rem',
  fontSize: '0.72rem', fontWeight: 600,
  color: '#dc2626', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '4px',
  cursor: 'pointer',
};
