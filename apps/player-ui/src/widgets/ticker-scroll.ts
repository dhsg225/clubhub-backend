/**
 * TickerScroll widget — horizontally scrolling text strip.
 * Self-registers on import as 'ticker_scroll'.
 *
 * Config:
 *   speed     — pixels per second (default: 80)
 *   direction — 'ltr' | 'rtl' (default: 'ltr')
 *   items     — string[] (injected by layout engine from corpus_key)
 */
import { registerWidget, type WidgetInstance } from '../widget-registry.js';

const SEPARATOR = '  ·  ';
const MIN_DURATION_S = 10;

registerWidget('ticker_scroll', (container, config): WidgetInstance => {
  const items = Array.isArray(config['items']) ? (config['items'] as string[]) : [];
  const speed = Number(config['speed']) || 80;
  const direction = config['direction'] === 'rtl' ? 'rtl' : 'ltr';

  if (items.length === 0) {
    return { destroy() { /* no-op */ } };
  }

  container.style.cssText = [
    'width:100%',
    'height:100%',
    'overflow:hidden',
    'display:flex',
    'align-items:center',
    'position:relative',
  ].join(';');

  // Inject @keyframes once per document
  const ltrId = '__ticker_scroll_ltr__';
  const rtlId = '__ticker_scroll_rtl__';
  if (!document.getElementById(ltrId)) {
    const style = document.createElement('style');
    style.id = ltrId;
    style.textContent = `
      @keyframes ticker-scroll-ltr { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
      @keyframes ticker-scroll-rtl { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    `;
    document.head.appendChild(style);
  }

  const inner = document.createElement('div');
  const text = items.join(SEPARATOR) + SEPARATOR;
  inner.textContent = text;

  const durationS = Math.max(MIN_DURATION_S, text.length * 14 / speed);
  const animName = direction === 'rtl' ? 'ticker-scroll-rtl' : 'ticker-scroll-ltr';

  inner.style.cssText = [
    'white-space:nowrap',
    'will-change:transform',
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'font-size:clamp(0.65rem,1.4cqw,0.9rem)',
    'font-weight:500',
    'letter-spacing:0.02em',
    `animation:${animName} ${durationS.toFixed(1)}s linear infinite`,
    'padding-left:1rem',
  ].join(';');

  container.appendChild(inner);

  function updateItems(newItems: string[]): void {
    const newText = newItems.join(SEPARATOR) + SEPARATOR;
    inner.textContent = newText;
    const newDuration = Math.max(MIN_DURATION_S, newText.length * 14 / speed);
    inner.style.animationDuration = `${newDuration.toFixed(1)}s`;
  }

  return {
    destroy() {
      container.innerHTML = '';
    },
    update(data: unknown) {
      if (Array.isArray(data)) updateItems(data as string[]);
    },
  };
});
