/**
 * Stub renderers for each canonical template type.
 * Each stub shows the template name + data fields as a visual placeholder
 * until a production renderer is built for that type.
 *
 * Add a new entry to STUB_COLORS + renderTemplateStub's switch when a new
 * template type is introduced.
 */

const STUB_COLORS: Record<string, string> = {
  promo_slide:   '#7C3AED', // violet
  event_banner:  '#EA580C', // orange
  sponsor_banner:'#16A34A', // green
  menu_board:    '#2563EB', // blue
  daily_specials:'#DC2626', // red
};

export function renderTemplateStub(
  container: HTMLElement,
  templateType: string,
  data: Record<string, unknown>,
  contentId: string,
): void {
  container.innerHTML = '';

  const bg = STUB_COLORS[templateType] ?? '#4B5563';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'width:100%', 'height:100%', `background:${bg}`,
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'padding:60px', 'box-sizing:border-box',
    'color:#fff', 'font-family:system-ui,sans-serif',
    'position:relative',
  ].join(';');

  // Template type badge (top-left)
  const badge = document.createElement('div');
  badge.style.cssText = [
    'position:absolute', 'top:40px', 'left:60px',
    'font-size:1rem', 'font-weight:700',
    'letter-spacing:0.15em', 'text-transform:uppercase', 'opacity:0.7',
  ].join(';');
  badge.textContent = templateType;
  wrapper.appendChild(badge);

  // Content ID (top-right)
  const idEl = document.createElement('div');
  idEl.style.cssText = [
    'position:absolute', 'top:40px', 'right:60px',
    'font-size:0.75rem', 'opacity:0.4', 'font-family:monospace',
  ].join(';');
  idEl.textContent = contentId;
  wrapper.appendChild(idEl);

  // STUB watermark (bottom-right)
  const stub = document.createElement('div');
  stub.style.cssText = [
    'position:absolute', 'bottom:40px', 'right:60px',
    'font-size:0.7rem', 'opacity:0.3',
    'letter-spacing:0.2em', 'font-weight:700',
  ].join(';');
  stub.textContent = 'STUB';
  wrapper.appendChild(stub);

  // Human-readable template name
  const title = document.createElement('div');
  title.style.cssText = [
    'font-size:4rem', 'font-weight:800',
    'margin-bottom:48px', 'letter-spacing:-0.02em', 'text-align:center',
  ].join(';');
  title.textContent = formatTemplateName(templateType);
  wrapper.appendChild(title);

  // Data fields
  const fields = document.createElement('div');
  fields.style.cssText = 'max-width:840px;width:100%;';

  const entries = Object.entries(data);
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'opacity:0.5;font-size:1.2rem;text-align:center;';
    empty.textContent = 'No data fields';
    fields.appendChild(empty);
  } else {
    for (const [key, value] of entries.slice(0, 8)) {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex', 'gap:24px', 'margin-bottom:14px',
        'font-size:1.1rem',
        'border-bottom:1px solid rgba(255,255,255,0.15)',
        'padding-bottom:14px',
      ].join(';');

      const keyEl = document.createElement('span');
      keyEl.style.cssText = 'opacity:0.55;min-width:220px;font-family:monospace;flex-shrink:0;';
      keyEl.textContent = key;

      const valEl = document.createElement('span');
      valEl.style.cssText = 'font-weight:600;word-break:break-word;';
      valEl.textContent = value === null || value === undefined
        ? '—'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

      row.appendChild(keyEl);
      row.appendChild(valEl);
      fields.appendChild(row);
    }

    if (entries.length > 8) {
      const more = document.createElement('div');
      more.style.cssText = 'opacity:0.4;font-size:0.9rem;text-align:center;margin-top:10px;';
      more.textContent = `+${entries.length - 8} more fields`;
      fields.appendChild(more);
    }
  }

  wrapper.appendChild(fields);
  container.appendChild(wrapper);
}

function formatTemplateName(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
