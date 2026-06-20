/**
 * DateDisplay widget — shows current date in "Friday 20 June" format.
 * Updates at midnight. Self-registers on import as 'date_display'.
 */
import { registerWidget, type WidgetInstance } from '../widget-registry.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

registerWidget('date_display', (container): WidgetInstance => {
  container.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:100%',
    'height:100%',
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'font-size:clamp(0.7rem,1.6cqw,1rem)',
    'font-weight:500',
    'overflow:hidden',
  ].join(';');

  const span = document.createElement('span');
  container.appendChild(span);

  let midnightTimer: ReturnType<typeof setTimeout> | null = null;

  function update(): void {
    span.textContent = formatDate(new Date());
    // Schedule next update at midnight
    midnightTimer = setTimeout(update, msUntilMidnight());
  }

  update();

  return {
    destroy() {
      if (midnightTimer !== null) clearTimeout(midnightTimer);
    },
  };
});
