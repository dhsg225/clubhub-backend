/**
 * TickerScroll widget — horizontally scrolling text strip.
 * Self-registers on import as 'ticker_scroll'.
 *
 * Source-agnostic: receives config.items as string[].
 * If items is empty, returns a no-op instance (clock fills the full ticker zone).
 * Speed: ~80px/s — animation-duration derived from total string length.
 */
import { registerWidget, type WidgetInstance } from '../widget-registry.js';

const SCROLL_SPEED_PX_PER_S = 80;
const MIN_DURATION_S = 10;
const SEPARATOR = '  ·  ';

registerWidget('ticker_scroll', (container, config): WidgetInstance => {
  const items = Array.isArray(config['items']) ? (config['items'] as string[]) : [];

  if (items.length === 0) {
    // No items — leave container empty; clock fills full ticker zone
    return { destroy() { /* no-op */ } };
  }

  // Build scrolling inner div
  container.style.cssText = [
    'width:100%',
    'height:100%',
    'overflow:hidden',
    'display:flex',
    'align-items:center',
    'position:relative',
  ].join(';');

  // Inject @keyframes once per document
  const styleId = '__ticker_scroll_kf__';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes ticker-scroll {
        from { transform: translateX(100%); }
        to   { transform: translateX(-100%); }
      }
    `;
    document.head.appendChild(style);
  }

  const inner = document.createElement('div');
  const text = items.join(SEPARATOR) + SEPARATOR;
  inner.textContent = text;

  const durationS = Math.max(MIN_DURATION_S, text.length * 14 / SCROLL_SPEED_PX_PER_S);

  inner.style.cssText = [
    'white-space:nowrap',
    'will-change:transform',
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'font-size:clamp(0.65rem,1.4cqw,0.9rem)',
    'font-weight:500',
    'letter-spacing:0.02em',
    `animation:ticker-scroll ${durationS.toFixed(1)}s linear infinite`,
    'animation-timing-function:linear',
    'padding-left:1rem',
  ].join(';');

  container.appendChild(inner);

  function update(newItems: string[]): void {
    const newText = newItems.join(SEPARATOR) + SEPARATOR;
    inner.textContent = newText;
    const newDuration = Math.max(MIN_DURATION_S, newText.length * 14 / SCROLL_SPEED_PX_PER_S);
    inner.style.animationDuration = `${newDuration.toFixed(1)}s`;
  }

  return {
    destroy() {
      container.innerHTML = '';
    },
    update(data: unknown) {
      if (Array.isArray(data)) update(data as string[]);
    },
  };
});
