export function Component(): JSX.Element {
  return <TemplateGallery />;
}

const TEMPLATES: TemplateSpec[] = [
  {
    type: 'promo_slide',
    color: '#7C3AED',
    description: 'General promotional slide — headline, sub-headline, optional image.',
    usage: 'Bar ambient · events · general-purpose.',
    fields: ['headline', 'subheadline', 'image_url', 'cta'],
    example: {
      headline: 'Happy Hour Every Friday',
      subheadline: '5pm – 9pm · All drinks 50% off',
      image_url: '(optional image)',
      cta: 'Show your app for a free drink',
    },
  },
  {
    type: 'event_banner',
    color: '#EA580C',
    description: 'Event announcement — name, date, time, description.',
    usage: 'Sports nights · live music · trivia · golf tournaments.',
    fields: ['event_name', 'date', 'time', 'description', 'image_url'],
    example: {
      event_name: 'Trivia Night — Every Wednesday',
      date: '2026-06-19',
      time: '7:00 PM',
      description: 'Teams of 4. Book a table to reserve your spot.',
    },
  },
  {
    type: 'sponsor_banner',
    color: '#16A34A',
    description: 'Sponsor acknowledgement — brand name, tagline, optional logo.',
    usage: 'Sponsor SOV delivery · ambient brand placement.',
    fields: ['sponsor_name', 'tagline', 'logo_url'],
    example: {
      sponsor_name: 'Proudly supported by Coopers',
      tagline: "Australia's family-owned brewery since 1862",
      logo_url: '(optional logo)',
    },
  },
  {
    type: 'menu_board',
    color: '#2563EB',
    description: 'Structured menu — sections with items, names and prices.',
    usage: 'Dining menu boards · task-engaged viewer contexts.',
    fields: ['sections → [ { title, items → [ { name, price } ] } ]'],
    example: {
      sections: [
        { title: 'Mains', items: [{ name: 'Chicken Schnitzel', price: '$22' }, { name: 'Fish & Chips', price: '$19' }] },
        { title: 'Desserts', items: [{ name: 'Sticky Date Pudding', price: '$12' }] },
      ],
    },
  },
  {
    type: 'daily_specials',
    color: '#DC2626',
    description: 'Daily specials list — date-specific items with prices, updated by venue staff.',
    usage: 'Bar / dining · updated each morning.',
    fields: ['date', 'items → [ { name, price, description? } ]'],
    example: {
      date: 'Thursday 19 June',
      items: [
        { name: 'Porterhouse 300g + chips', price: '$28' },
        { name: 'House red or white wine', price: '$8 / glass' },
      ],
    },
  },
];

interface TemplateSpec {
  type: string;
  color: string;
  description: string;
  usage: string;
  fields: string[];
  example: Record<string, unknown>;
}

function TemplateGallery(): JSX.Element {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Template Gallery</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
          Visual stubs for each content template type. These are exactly what a Pi screen renders until a production design replaces the stub.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))', gap: '2.5rem' }}>
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.type} spec={t} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ spec }: { spec: TemplateSpec }): JSX.Element {
  return (
    <div>
      {/* 16:9 preview */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <TemplatePreview spec={spec} />
        </div>
      </div>

      {/* Info below preview */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: spec.color,
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}>
            {spec.type}
          </span>
        </div>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
          {spec.description}
        </p>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          {spec.usage}
        </p>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
          {spec.fields.map((f) => (
            <div key={f} style={{ marginBottom: '2px' }}>• {f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ spec }: { spec: TemplateSpec }): JSX.Element {
  const entries = flattenForDisplay(spec.example);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: spec.color,
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6% 8%',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Template type badge */}
      <div style={{
        position: 'absolute',
        top: '6%',
        left: '8%',
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        opacity: 0.65,
        fontFamily: 'monospace',
      }}>
        {spec.type}
      </div>

      {/* STUB watermark */}
      <div style={{
        position: 'absolute',
        bottom: '5%',
        right: '6%',
        fontSize: '0.55rem',
        fontWeight: 700,
        letterSpacing: '0.2em',
        opacity: 0.3,
      }}>
        STUB
      </div>

      {/* Template name */}
      <div style={{
        fontSize: 'clamp(1.2rem, 4vw, 2.2rem)',
        fontWeight: 800,
        marginBottom: '8%',
        textAlign: 'center',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>
        {formatTemplateName(spec.type)}
      </div>

      {/* Data fields */}
      <div style={{ width: '100%', maxWidth: '600px' }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '5%',
            fontSize: 'clamp(0.5rem, 1.5vw, 0.85rem)',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            paddingBottom: '4%',
          }}>
            <span style={{ opacity: 0.55, minWidth: '35%', fontFamily: 'monospace', flexShrink: 0 }}>{key}</span>
            <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function flattenForDisplay(data: Record<string, unknown>, prefix = ''): [string, string][] {
  const result: [string, string][] = [];
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      result.push([fullKey, `[ ${value.length} item${value.length !== 1 ? 's' : ''} ]`]);
    } else if (value !== null && typeof value === 'object') {
      result.push(...flattenForDisplay(value as Record<string, unknown>, fullKey));
    } else {
      result.push([fullKey, String(value ?? '—')]);
    }
    if (result.length >= 6) break;
  }
  return result;
}

function formatTemplateName(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
