/**
 * Clock widget — live HH:MM:SS display, updates every second.
 * Self-registers on import as 'clock'.
 *
 * Config:
 *   timezone — IANA timezone string (default: 'Asia/Singapore')
 */
import { registerWidget, type WidgetInstance } from '../widget-registry.js';

registerWidget('clock', (container, config): WidgetInstance => {
  const timezone = (typeof config['timezone'] === 'string' && config['timezone'])
    ? config['timezone']
    : 'Asia/Singapore';

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

  const formatter = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone,
  });

  function tick(): void {
    span.textContent = formatter.format(new Date());
  }

  tick();
  const interval = setInterval(tick, 1_000);

  return {
    destroy() {
      clearInterval(interval);
    },
  };
});
