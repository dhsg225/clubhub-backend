/**
 * Standalone fullscreen template preview.
 * Route: /preview/content/:id — no sidebar, no nav.
 * Opens in a new window from ContentDetail. Shows exactly what the Pi renders.
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

export function Component(): JSX.Element {
  return <ContentPreview />;
}

interface ContentItem {
  id: string;
  template_type: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

const STUB_COLORS: Record<string, string> = {
  promo_slide:    '#7C3AED',
  event_banner:   '#EA580C',
  sponsor_banner: '#16A34A',
  menu_board:     '#2563EB',
  daily_specials: '#DC2626',
};

function ContentPreview(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  const { data: item, isLoading, isError } = useQuery<ContentItem>({
    queryKey: ['content-preview', id],
    queryFn: () => api.get<ContentItem>(`/content/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div style={fullscreenStyle('#111')}>
        <div style={{ color: '#fff', opacity: 0.5, fontFamily: 'system-ui', fontSize: '1rem' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div style={fullscreenStyle('#111')}>
        <div style={{ color: '#ef4444', fontFamily: 'system-ui', fontSize: '1rem' }}>
          Content not found
        </div>
      </div>
    );
  }

  return <TemplateStub item={item} />;
}

function TemplateStub({ item }: { item: ContentItem }): JSX.Element {
  if (item.template_type === 'promo_slide') {
    return <PromoSlideRenderer item={item} />;
  }

  const bg = STUB_COLORS[item.template_type] ?? '#4B5563';
  const data = item.data ?? {};
  const entries = flattenEntries(data);

  const title = deriveTitle(item);

  return (
    <div style={fullscreenStyle(bg)}>
      {/* Template type badge — top left */}
      <div style={{
        position: 'absolute', top: '5%', left: '6%',
        fontFamily: 'monospace', fontSize: 'clamp(0.6rem, 1.2vw, 1rem)',
        fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.65,
        color: '#fff',
      }}>
        {item.template_type}
      </div>

      {/* STUB watermark — top right */}
      <div style={{
        position: 'absolute', top: '5%', right: '6%',
        fontFamily: 'monospace', fontSize: 'clamp(0.5rem, 1vw, 0.8rem)',
        fontWeight: 700, letterSpacing: '0.2em', opacity: 0.25, color: '#fff',
      }}>
        STUB
      </div>

      {/* Content ID — bottom left */}
      <div style={{
        position: 'absolute', bottom: '5%', left: '6%',
        fontFamily: 'monospace', fontSize: 'clamp(0.45rem, 0.8vw, 0.7rem)',
        opacity: 0.35, color: '#fff',
      }}>
        {item.id}
      </div>

      {/* Close hint — bottom right */}
      <div style={{
        position: 'absolute', bottom: '5%', right: '6%',
        fontFamily: 'system-ui', fontSize: 'clamp(0.45rem, 0.8vw, 0.7rem)',
        opacity: 0.35, color: '#fff',
      }}>
        close window to return
      </div>

      {/* Template name */}
      <div style={{
        color: '#fff', fontFamily: 'system-ui, sans-serif',
        fontSize: 'clamp(2rem, 6vw, 5rem)',
        fontWeight: 800, letterSpacing: '-0.02em',
        marginBottom: '6%', textAlign: 'center', lineHeight: 1.1,
      }}>
        {title}
      </div>

      {/* Data fields */}
      <div style={{ width: '55%', maxWidth: '900px' }}>
        {entries.length === 0 ? (
          <div style={{ color: '#fff', opacity: 0.4, fontFamily: 'system-ui', textAlign: 'center' }}>
            No data fields
          </div>
        ) : (
          entries.map(([key, val]) => (
            <div key={key} style={{
              display: 'flex', gap: '3%', marginBottom: '3%',
              borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3%',
              fontSize: 'clamp(0.65rem, 1.8vw, 1.1rem)', color: '#fff',
            }}>
              <span style={{ opacity: 0.55, minWidth: '32%', fontFamily: 'monospace', flexShrink: 0 }}>
                {key}
              </span>
              <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{val}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PromoSlideRenderer({ item }: { item: ContentItem }): JSX.Element {
  const data = item.data ?? {};
  const bg = (data.background_color as string) ?? '#1a1a2e';
  const textColor = (data.text_color as string) ?? '#ffffff';
  const title = (data.title as string) ?? '';
  const subtitle = (data.subtitle as string) ?? '';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Content ID — bottom left */}
      <div style={{
        position: 'absolute', bottom: '5%', left: '6%',
        fontFamily: 'monospace', fontSize: 'clamp(0.45rem, 0.8vw, 0.7rem)',
        opacity: 0.3, color: textColor,
      }}>
        {item.id}
      </div>
      {/* Close hint — bottom right */}
      <div style={{
        position: 'absolute', bottom: '5%', right: '6%',
        fontFamily: 'system-ui', fontSize: 'clamp(0.45rem, 0.8vw, 0.7rem)',
        opacity: 0.3, color: textColor,
      }}>
        close window to return
      </div>

      {title && (
        <div style={{
          color: textColor,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(2.5rem, 8vw, 6rem)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          lineHeight: 1.1,
          maxWidth: '80%',
          marginBottom: subtitle ? '4%' : 0,
        }}>
          {title}
        </div>
      )}
      {subtitle && (
        <div style={{
          color: textColor,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(1rem, 3vw, 2rem)',
          fontWeight: 400,
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: '65%',
          opacity: 0.75,
        }}>
          {subtitle}
        </div>
      )}
      {!title && !subtitle && (
        <div style={{ color: textColor, opacity: 0.4, fontFamily: 'system-ui', textAlign: 'center', fontSize: '1rem' }}>
          No content — fill in title and subtitle in the form
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function fullscreenStyle(bg: string): React.CSSProperties {
  return {
    position: 'fixed', inset: 0,
    backgroundColor: bg,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  };
}

function deriveTitle(item: ContentItem): string {
  const d = item.data ?? {};
  if (typeof d.headline === 'string' && d.headline.trim()) return d.headline;
  if (typeof d.event_name === 'string' && d.event_name.trim()) return d.event_name;
  if (typeof d.sponsor_name === 'string' && d.sponsor_name.trim()) return d.sponsor_name;
  if (typeof d.title === 'string' && d.title.trim()) return d.title;
  if (typeof d.name === 'string' && d.name.trim()) return d.name;
  return item.template_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function flattenEntries(data: Record<string, unknown>, prefix = ''): [string, string][] {
  const result: [string, string][] = [];
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      result.push([fullKey, `[ ${value.length} item${value.length !== 1 ? 's' : ''} ]`]);
    } else if (value !== null && typeof value === 'object') {
      result.push(...flattenEntries(value as Record<string, unknown>, fullKey));
    } else {
      result.push([fullKey, value === null || value === undefined ? '—' : String(value)]);
    }
    if (result.length >= 7) break;
  }
  return result;
}
