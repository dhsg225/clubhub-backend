/**
 * Card renderers for each canonical template type (D-016 vocabulary).
 * Each known type has a real visual renderer. Unknown/future types fall back
 * to a coloured placeholder.
 *
 * Add a new entry to CARD_FALLBACK_COLORS + renderCard's switch when a new
 * template type is introduced.
 */

const CARD_FALLBACK_COLORS: Record<string, string> = {
  promo_slide:   '#7C3AED', // violet
  event_banner:  '#EA580C', // orange
  sponsor_banner:'#16A34A', // green
  menu_board:    '#2563EB', // blue
  daily_specials:'#DC2626', // red
};

export function renderCard(
  container: HTMLElement,
  templateType: string,
  data: Record<string, unknown>,
  contentId: string,
): void {
  container.innerHTML = '';

  // promo_slide: real renderer — uses background_color, text_color, title, subtitle
  if (templateType === 'promo_slide') {
    const bg = (data.background_color as string) ?? '#1a1a2e';
    const textColor = (data.text_color as string) ?? '#ffffff';
    const title = (data.title as string) ?? '';
    const subtitle = (data.subtitle as string) ?? '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'width:100%', 'height:100%', `background:${bg}`,
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'box-sizing:border-box', 'position:relative', 'overflow:hidden',
    ].join(';');

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.style.cssText = [
        `color:${textColor}`,
        'font-family:system-ui,sans-serif',
        'font-size:clamp(2.5rem, 8vw, 6rem)',
        'font-weight:800',
        'letter-spacing:-0.02em',
        'text-align:center',
        'line-height:1.1',
        'max-width:80%',
        subtitle ? 'margin-bottom:4%' : '',
      ].filter(Boolean).join(';');
      titleEl.textContent = title;
      wrapper.appendChild(titleEl);
    }

    if (subtitle) {
      const subtitleEl = document.createElement('div');
      subtitleEl.style.cssText = [
        `color:${textColor}`,
        'font-family:system-ui,sans-serif',
        'font-size:clamp(1rem, 3vw, 2rem)',
        'font-weight:400',
        'text-align:center',
        'line-height:1.4',
        'max-width:65%',
        'opacity:0.75',
      ].join(';');
      subtitleEl.textContent = subtitle;
      wrapper.appendChild(subtitleEl);
    }

    if (!title && !subtitle) {
      const emptyEl = document.createElement('div');
      emptyEl.style.cssText = `color:${textColor};opacity:0.4;font-family:system-ui,sans-serif;text-align:center;font-size:1rem;`;
      emptyEl.textContent = 'No content — fill in title and subtitle in the form';
      wrapper.appendChild(emptyEl);
    }

    container.appendChild(wrapper);
    return;
  }

  // event_banner: real renderer
  if (templateType === 'event_banner') {
    const eventName   = typeof data.event_name   === 'string' ? data.event_name   : '';
    const date        = typeof data.date         === 'string' ? data.date         : '';
    const time        = typeof data.time         === 'string' ? data.time         : '';
    const description = typeof data.description  === 'string' ? data.description  : '';
    const dateTime    = [date, time].filter(Boolean).join('  ·  ');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:8%;overflow:hidden;';

    if (eventName) {
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'color:#fff;font-family:system-ui,sans-serif;font-size:clamp(2rem,6vw,5rem);font-weight:800;letter-spacing:-0.02em;text-align:center;line-height:1.1;max-width:80%;margin-bottom:6%;';
      nameEl.textContent = eventName;
      wrapper.appendChild(nameEl);
    }
    if (dateTime) {
      const dtEl = document.createElement('div');
      dtEl.style.cssText = 'color:#EA580C;font-family:system-ui,sans-serif;font-size:clamp(1rem,3vw,2.2rem);font-weight:700;text-align:center;margin-bottom:5%;letter-spacing:0.04em;';
      dtEl.textContent = dateTime;
      wrapper.appendChild(dtEl);
    }
    if (description) {
      const descEl = document.createElement('div');
      descEl.style.cssText = 'color:#fff;font-family:system-ui,sans-serif;font-size:clamp(0.75rem,2vw,1.4rem);font-weight:400;text-align:center;line-height:1.5;max-width:65%;opacity:0.7;';
      descEl.textContent = description;
      wrapper.appendChild(descEl);
    }

    container.appendChild(wrapper);
    return;
  }

  // sponsor_banner: real renderer
  if (templateType === 'sponsor_banner') {
    const sponsorName = typeof data.sponsor_name === 'string' ? data.sponsor_name : '';
    const tagline     = typeof data.tagline      === 'string' ? data.tagline      : '';
    const tier        = typeof data.tier         === 'string' ? data.tier         : '';
    const tierColors: Record<string, string> = { Platinum: '#e5e4e2', Gold: '#FFD700', Silver: '#C0C0C0' };
    const tierColor = tierColors[tier] ?? '#e5e4e2';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:8%;overflow:hidden;';

    if (sponsorName) {
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'color:#fff;font-family:system-ui,sans-serif;font-size:clamp(2.5rem,7vw,5.5rem);font-weight:800;letter-spacing:-0.02em;text-align:center;line-height:1.1;max-width:80%;margin-bottom:5%;';
      nameEl.textContent = sponsorName;
      wrapper.appendChild(nameEl);
    }
    if (tier) {
      const tierEl = document.createElement('div');
      tierEl.style.cssText = `background:${tierColor};color:#111;font-family:system-ui,sans-serif;font-size:clamp(0.75rem,1.8vw,1.2rem);font-weight:700;padding:0.4em 1.2em;border-radius:999px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6%;`;
      tierEl.textContent = tier;
      wrapper.appendChild(tierEl);
    }
    if (tagline) {
      const tagEl = document.createElement('div');
      tagEl.style.cssText = 'color:#fff;font-family:system-ui,sans-serif;font-size:clamp(0.8rem,2.2vw,1.5rem);font-weight:400;text-align:center;line-height:1.4;max-width:60%;opacity:0.7;';
      tagEl.textContent = tagline;
      wrapper.appendChild(tagEl);
    }

    container.appendChild(wrapper);
    return;
  }

  // menu_board: real renderer
  if (templateType === 'menu_board') {
    const rawSections = Array.isArray(data.sections) ? data.sections as { section_title?: string; items?: { name?: string; price?: string }[] }[] : [];
    const sections = rawSections.filter(s => s && typeof s === 'object');
    const isTwoCol = sections.length >= 2;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:6% 8%;overflow:hidden;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:row;gap:4%;width:100%;max-width:1400px;';

    for (const section of sections) {
      const col = document.createElement('div');
      col.style.cssText = `flex:0 0 ${isTwoCol ? '48%' : '100%'};min-width:0;`;

      if (section.section_title) {
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'color:#fff;font-family:system-ui,sans-serif;font-size:clamp(0.8rem,2vw,1.4rem);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(255,255,255,0.3);padding-bottom:0.5em;margin-bottom:0.75em;';
        titleEl.textContent = section.section_title;
        col.appendChild(titleEl);
      }

      const items = section.items ?? [];
      items.forEach((it, ii) => {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = `display:flex;justify-content:space-between;color:#fff;font-family:system-ui,sans-serif;font-size:clamp(0.65rem,1.4vw,1rem);padding:0.4em 0;${ii < items.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.1);' : ''}`;
        if (it.name) {
          const nameEl = document.createElement('span');
          nameEl.textContent = it.name;
          itemRow.appendChild(nameEl);
        }
        if (it.price) {
          const priceEl = document.createElement('span');
          priceEl.style.cssText = 'opacity:0.85;';
          priceEl.textContent = it.price;
          itemRow.appendChild(priceEl);
        }
        col.appendChild(itemRow);
      });

      row.appendChild(col);
    }

    wrapper.appendChild(row);
    container.appendChild(wrapper);
    return;
  }

  // daily_specials: real renderer
  if (templateType === 'daily_specials') {
    const headline = typeof data.headline === 'string' ? data.headline : '';
    const rawItems = Array.isArray(data.items) ? data.items as { dish_name?: string; price?: string }[] : [];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;background:#1a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:6% 10%;overflow:hidden;';

    if (headline) {
      const headEl = document.createElement('div');
      headEl.style.cssText = 'color:#DC2626;font-family:system-ui,sans-serif;font-size:clamp(1.5rem,4.5vw,3.5rem);font-weight:800;text-transform:uppercase;text-align:center;letter-spacing:0.06em;margin-bottom:6%;';
      headEl.textContent = headline;
      wrapper.appendChild(headEl);
    }

    const list = document.createElement('div');
    list.style.cssText = 'width:100%;max-width:900px;';
    rawItems.forEach((it, ii) => {
      const itemRow = document.createElement('div');
      itemRow.style.cssText = `display:flex;justify-content:space-between;color:#fff;font-family:system-ui,sans-serif;font-size:clamp(0.75rem,2vw,1.3rem);padding:0.55em 0;${ii < rawItems.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.12);' : ''}`;
      if (it.dish_name) {
        const nameEl = document.createElement('span');
        nameEl.textContent = it.dish_name;
        itemRow.appendChild(nameEl);
      }
      if (it.price) {
        const priceEl = document.createElement('span');
        priceEl.style.cssText = 'opacity:0.85;';
        priceEl.textContent = it.price;
        itemRow.appendChild(priceEl);
      }
      list.appendChild(itemRow);
    });
    wrapper.appendChild(list);
    container.appendChild(wrapper);
    return;
  }

  const bg = CARD_FALLBACK_COLORS[templateType] ?? '#4B5563';

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
