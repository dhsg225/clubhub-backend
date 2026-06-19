/**
 * Card Authoring Form — create a new content card.
 * Route: /content/new
 *
 * Split-panel layout:
 *   LEFT  — form: template selector, field set, expiry, save
 *   RIGHT — live 16:9 preview that mirrors form state in real time
 *
 * POSTs to POST /content with { template_type, data }.
 * expires_at is stored inside the data JSONB blob (no dedicated DB column yet).
 *
 * D-013: Card → Playlist → Schedule → Screen content hierarchy.
 * D-014: Form-based, brand-locked, expiry required.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

/* ================================================================== *
 * Template types and field schemas
 * ================================================================== */

type TemplateType =
  | 'promo_slide'
  | 'event_banner'
  | 'sponsor_banner'
  | 'menu_board'
  | 'daily_specials';

const TEMPLATE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'promo_slide',    label: 'Promo Slide' },
  { value: 'event_banner',   label: 'Event Banner' },
  { value: 'sponsor_banner', label: 'Sponsor Banner' },
  { value: 'menu_board',     label: 'Menu Board' },
  { value: 'daily_specials', label: 'Daily Specials' },
];

const STUB_COLORS: Record<TemplateType, string> = {
  promo_slide:    '#7C3AED',
  event_banner:   '#EA580C',
  sponsor_banner: '#16A34A',
  menu_board:     '#2563EB',
  daily_specials: '#DC2626',
};

/* ------------------------------------------------------------------ *
 * Per-template data shapes
 * ------------------------------------------------------------------ */

interface PromoSlideData {
  title: string;
  subtitle: string;
  background_color: string;
  text_color: string;
}

interface EventBannerData {
  event_name: string;
  date: string;
  time: string;
  description: string;
}

type SponsorTier = 'Platinum' | 'Gold' | 'Silver';
interface SponsorBannerData {
  sponsor_name: string;
  tagline: string;
  tier: SponsorTier;
}

interface MenuItem { name: string; price: string; }
interface MenuSection { section_title: string; items: MenuItem[]; }
interface MenuBoardData { sections: MenuSection[]; }

interface SpecialItem { dish_name: string; price: string; }
interface DailySpecialsData { headline: string; items: SpecialItem[]; }

type TemplateData =
  | PromoSlideData
  | EventBannerData
  | SponsorBannerData
  | MenuBoardData
  | DailySpecialsData;

/* ------------------------------------------------------------------ *
 * Default form data per template
 * ------------------------------------------------------------------ */

function defaultData(type: TemplateType): TemplateData {
  switch (type) {
    case 'promo_slide':
      return { title: '', subtitle: '', background_color: '#1a1a2e', text_color: '#ffffff' };
    case 'event_banner':
      return { event_name: '', date: '', time: '', description: '' };
    case 'sponsor_banner':
      return { sponsor_name: '', tagline: '', tier: 'Gold' };
    case 'menu_board':
      return { sections: [{ section_title: '', items: [{ name: '', price: '' }] }] };
    case 'daily_specials':
      return { headline: '', items: [{ dish_name: '', price: '' }] };
  }
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
 * Template-specific field sets
 * ================================================================== */

function PromoSlideFields({
  data, onChange,
}: {
  data: PromoSlideData;
  onChange: (d: PromoSlideData) => void;
}): JSX.Element {
  return (
    <>
      <FieldGroup>
        <FieldLabel>Title</FieldLabel>
        <TextField value={data.title} onChange={(v) => onChange({ ...data, title: v })} maxLength={45} placeholder="Main headline" />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>Subtitle</FieldLabel>
        <TextField value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} maxLength={80} placeholder="Supporting text" multiline />
      </FieldGroup>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <FieldLabel>Background colour</FieldLabel>
          <input type="color" value={data.background_color}
            onChange={(e) => onChange({ ...data, background_color: e.target.value })}
            style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{data.background_color}</span>
        </div>
        <div>
          <FieldLabel>Text colour</FieldLabel>
          <input type="color" value={data.text_color}
            onChange={(e) => onChange({ ...data, text_color: e.target.value })}
            style={{ width: '100%', height: '2.25rem', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer' }} />
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{data.text_color}</span>
        </div>
      </div>
    </>
  );
}

function EventBannerFields({
  data, onChange,
}: {
  data: EventBannerData;
  onChange: (d: EventBannerData) => void;
}): JSX.Element {
  return (
    <>
      <FieldGroup>
        <FieldLabel>Event name</FieldLabel>
        <TextField value={data.event_name} onChange={(v) => onChange({ ...data, event_name: v })} maxLength={50} placeholder="e.g. Trivia Night" />
      </FieldGroup>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <FieldLabel>Date</FieldLabel>
          <input type="date" value={data.date} onChange={(e) => onChange({ ...data, date: e.target.value })}
            style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <input type="time" value={data.time} onChange={(e) => onChange({ ...data, time: e.target.value })}
            style={inputStyle} />
        </div>
      </div>
      <FieldGroup>
        <FieldLabel>Description</FieldLabel>
        <TextField value={data.description} onChange={(v) => onChange({ ...data, description: v })} maxLength={120} placeholder="Additional details" multiline />
      </FieldGroup>
    </>
  );
}

function SponsorBannerFields({
  data, onChange,
}: {
  data: SponsorBannerData;
  onChange: (d: SponsorBannerData) => void;
}): JSX.Element {
  return (
    <>
      <FieldGroup>
        <FieldLabel>Sponsor name</FieldLabel>
        <TextField value={data.sponsor_name} onChange={(v) => onChange({ ...data, sponsor_name: v })} maxLength={40} placeholder="e.g. Acme Corp" />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>Tagline</FieldLabel>
        <TextField value={data.tagline} onChange={(v) => onChange({ ...data, tagline: v })} maxLength={80} placeholder="e.g. Proud sponsor of live sport" />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>Tier</FieldLabel>
        <select value={data.tier} onChange={(e) => onChange({ ...data, tier: e.target.value as SponsorTier })}
          style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="Platinum">Platinum</option>
          <option value="Gold">Gold</option>
          <option value="Silver">Silver</option>
        </select>
      </FieldGroup>
    </>
  );
}

function MenuBoardFields({
  data, onChange,
}: {
  data: MenuBoardData;
  onChange: (d: MenuBoardData) => void;
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
  data: DailySpecialsData;
  onChange: (d: DailySpecialsData) => void;
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
 * Live preview panel — renders form state in 16:9 stub
 * Same colour scheme as ContentPreview.tsx / TemplateStub
 * ================================================================== */

function derivePreviewTitle(type: TemplateType, data: TemplateData): string {
  switch (type) {
    case 'promo_slide': {
      const d = data as PromoSlideData;
      return d.title || 'Promo Slide';
    }
    case 'event_banner': {
      const d = data as EventBannerData;
      return d.event_name || 'Event Banner';
    }
    case 'sponsor_banner': {
      const d = data as SponsorBannerData;
      return d.sponsor_name || 'Sponsor Banner';
    }
    case 'menu_board':
      return 'Menu Board';
    case 'daily_specials': {
      const d = data as DailySpecialsData;
      return d.headline || 'Daily Specials';
    }
  }
}

function derivePreviewBg(type: TemplateType, data: TemplateData): string {
  if (type === 'promo_slide') {
    return (data as PromoSlideData).background_color || STUB_COLORS[type];
  }
  return STUB_COLORS[type];
}

function derivePreviewTextColor(type: TemplateType, data: TemplateData): string {
  if (type === 'promo_slide') return (data as PromoSlideData).text_color || '#ffffff';
  return '#ffffff';
}

function previewEntries(type: TemplateType, data: TemplateData): [string, string][] {
  switch (type) {
    case 'promo_slide': {
      const d = data as PromoSlideData;
      return [
        ['subtitle', d.subtitle],
        ['bg', d.background_color],
        ['text', d.text_color],
      ].filter(([, v]) => v) as [string, string][];
    }
    case 'event_banner': {
      const d = data as EventBannerData;
      return [
        ['date', d.date],
        ['time', d.time],
        ['description', d.description],
      ].filter(([, v]) => v) as [string, string][];
    }
    case 'sponsor_banner': {
      const d = data as SponsorBannerData;
      return [
        ['tagline', d.tagline],
        ['tier', d.tier],
      ].filter(([, v]) => v) as [string, string][];
    }
    case 'menu_board': {
      const d = data as MenuBoardData;
      const entries: [string, string][] = [];
      for (const s of d.sections) {
        if (s.section_title) entries.push([s.section_title, s.items.filter(i => i.name).map(i => `${i.name}${i.price ? ' ' + i.price : ''}`).join(', ')]);
      }
      return entries;
    }
    case 'daily_specials': {
      const d = data as DailySpecialsData;
      return d.items
        .filter(i => i.dish_name)
        .map(i => [i.dish_name, i.price] as [string, string]);
    }
  }
}

function LivePreview({ type, data }: { type: TemplateType; data: TemplateData }): JSX.Element {
  const bg = derivePreviewBg(type, data);
  const textColor = derivePreviewTextColor(type, data);
  const title = derivePreviewTitle(type, data);
  const entries = previewEntries(type, data);

  return (
    /* 16:9 aspect ratio wrapper */
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Template type badge — top left */}
        <div style={{
          position: 'absolute', top: '5%', left: '5%',
          fontFamily: 'monospace', fontSize: 'clamp(0.45rem, 1.5vw, 0.7rem)',
          fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          opacity: 0.65, color: textColor,
        }}>
          {type}
        </div>

        {/* DRAFT watermark — top right */}
        <div style={{
          position: 'absolute', top: '5%', right: '5%',
          fontFamily: 'monospace', fontSize: 'clamp(0.4rem, 1.2vw, 0.65rem)',
          fontWeight: 700, letterSpacing: '0.2em', opacity: 0.3, color: textColor,
        }}>
          PREVIEW
        </div>

        {/* Title */}
        <div style={{
          color: textColor, fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(1rem, 4.5vw, 3.5rem)',
          fontWeight: 800, letterSpacing: '-0.02em',
          marginBottom: '4%', textAlign: 'center', lineHeight: 1.1,
          padding: '0 8%', wordBreak: 'break-word',
        }}>
          {title}
        </div>

        {/* Field entries */}
        <div style={{ width: '70%', maxWidth: '900px' }}>
          {entries.map(([key, val]) => (
            <div key={key} style={{
              display: 'flex', gap: '3%', marginBottom: '2%',
              borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '2%',
              fontSize: 'clamp(0.5rem, 1.4vw, 0.85rem)', color: textColor,
            }}>
              <span style={{ opacity: 0.55, minWidth: '32%', fontFamily: 'monospace', flexShrink: 0 }}>
                {key}
              </span>
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
 * Validation
 * ================================================================== */

function validate(type: TemplateType, data: TemplateData, expiresAt: string, noExpiry: boolean): string | null {
  if (!noExpiry && !expiresAt) return 'Expiry date is required. Check "No expiry" if this card runs indefinitely.';

  switch (type) {
    case 'promo_slide': {
      const d = data as PromoSlideData;
      if (!d.title.trim()) return 'Title is required for Promo Slide.';
      if (d.title.length > 45) return 'Title exceeds 45 characters.';
      if (d.subtitle.length > 80) return 'Subtitle exceeds 80 characters.';
      break;
    }
    case 'event_banner': {
      const d = data as EventBannerData;
      if (!d.event_name.trim()) return 'Event name is required.';
      if (d.event_name.length > 50) return 'Event name exceeds 50 characters.';
      if (d.description.length > 120) return 'Description exceeds 120 characters.';
      break;
    }
    case 'sponsor_banner': {
      const d = data as SponsorBannerData;
      if (!d.sponsor_name.trim()) return 'Sponsor name is required.';
      if (d.sponsor_name.length > 40) return 'Sponsor name exceeds 40 characters.';
      if (d.tagline.length > 80) return 'Tagline exceeds 80 characters.';
      break;
    }
    case 'menu_board': {
      const d = data as MenuBoardData;
      for (const s of d.sections) {
        if (s.section_title.length > 30) return 'Section title exceeds 30 characters.';
        for (const item of s.items) {
          if (item.name.length > 30) return 'Menu item name exceeds 30 characters.';
          if (item.price.length > 10) return 'Menu item price exceeds 10 characters.';
        }
      }
      break;
    }
    case 'daily_specials': {
      const d = data as DailySpecialsData;
      if (!d.headline.trim()) return 'Headline is required for Daily Specials.';
      if (d.headline.length > 30) return 'Headline exceeds 30 characters.';
      for (const item of d.items) {
        if (item.dish_name.length > 30) return 'Dish name exceeds 30 characters.';
        if (item.price.length > 10) return 'Price exceeds 10 characters.';
      }
      break;
    }
  }
  return null;
}

/* ================================================================== *
 * MAIN COMPONENT
 * ================================================================== */

export function Component(): JSX.Element {
  const navigate = useNavigate();

  const [templateType, setTemplateType] = useState<TemplateType>('promo_slide');
  const [formData, setFormData] = useState<TemplateData>(() => defaultData('promo_slide'));
  const [expiresAt, setExpiresAt] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: (payload: { template_type: string; data: Record<string, unknown> }) =>
      api.post<{ id: string }>('/content', payload),
    onSuccess: () => {
      navigate('/campaigns');
    },
  });

  function handleTemplateChange(type: TemplateType): void {
    setTemplateType(type);
    setFormData(defaultData(type));
    setValidationError(null);
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const err = validate(templateType, formData, expiresAt, noExpiry);
    if (err) { setValidationError(err); return; }
    setValidationError(null);

    const data = {
      ...(formData as unknown as Record<string, unknown>),
      expires_at: noExpiry ? null : expiresAt,
    };
    save({ template_type: templateType, data });
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/campaigns" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
          ← Campaigns
        </Link>
        <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>New campaign</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          Choose a template, fill in the fields, then save.
        </p>
      </div>

      {/* Split panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* ---- LEFT: Form ---- */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Template selector */}
          <FieldGroup>
            <FieldLabel>Template type</FieldLabel>
            <select
              value={templateType}
              onChange={(e) => handleTemplateChange(e.target.value as TemplateType)}
              style={{ ...inputStyle, fontWeight: 600 }}
            >
              {TEMPLATE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FieldGroup>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.25rem 0 1rem' }} />

          {/* Template-specific fields */}
          {templateType === 'promo_slide' && (
            <PromoSlideFields data={formData as PromoSlideData} onChange={setFormData} />
          )}
          {templateType === 'event_banner' && (
            <EventBannerFields data={formData as EventBannerData} onChange={setFormData} />
          )}
          {templateType === 'sponsor_banner' && (
            <SponsorBannerFields data={formData as SponsorBannerData} onChange={setFormData} />
          )}
          {templateType === 'menu_board' && (
            <MenuBoardFields data={formData as MenuBoardData} onChange={setFormData} />
          )}
          {templateType === 'daily_specials' && (
            <DailySpecialsFields data={formData as DailySpecialsData} onChange={setFormData} />
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
              <input
                type="checkbox"
                checked={noExpiry}
                onChange={(e) => { setNoExpiry(e.target.checked); if (e.target.checked) setExpiresAt(''); }}
              />
              No expiry — runs indefinitely
            </label>
          </FieldGroup>

          {/* Validation error */}
          {validationError && (
            <div role="alert" style={{
              padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '5px',
              color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem',
            }}>
              {validationError}
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div role="alert" style={{
              padding: '0.625rem 0.75rem', backgroundColor: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '5px',
              color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem',
            }}>
              Save failed: {saveError instanceof Error ? saveError.message : String(saveError)}
            </div>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: isPending ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '0.9rem', fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
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
