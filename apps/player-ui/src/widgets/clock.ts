/**
 * Clock widget — live HH:MM:SS display, updates every second.
 * Self-registers on import as 'clock'.
 */
import { registerWidget, type WidgetInstance } from '../widget-registry.js';

registerWidget('clock', (container): WidgetInstance => {
  container.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:100%',
    'height:100%',
    'color:#fff',
    'font-family:monospace',
    'font-size:clamp(0.7rem,1.6cqw,1rem)',
    'font-weight:600',
    'letter-spacing:0.05em',
    'overflow:hidden',
  ].join(';');

  const span = document.createElement('span');
  container.appendChild(span);

  function tick(): void {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    span.textContent = `${hh}:${mm}:${ss}`;
  }

  tick();
  const interval = setInterval(tick, 1_000);

  return {
    destroy() {
      clearInterval(interval);
    },
  };
});
