/**
 * DateDisplay widget — shows current date. Updates at midnight.
 * Self-registers on import as 'date_display'.
 *
 * Config:
 *   timezone — IANA timezone string (default: 'Asia/Singapore')
 *   format   — 'DD MMM YYYY' | 'DDD DD MMM' | 'DD/MM/YYYY' (default: 'DD MMM YYYY')
 */
import { registerWidget, type WidgetInstance } from '../widget-registry.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: Date, tz: string, fmt: string): string {
  // Use Intl to get timezone-correct date parts
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('day').padStart(2, '0');
  const month = parseInt(get('month'), 10);
  const year = get('year');
  const weekday = get('weekday');

  switch (fmt) {
    case 'DDD DD MMM':
      return `${weekday} ${parseInt(day, 10)} ${MONTH_SHORT[month - 1] ?? ''}`;
    case 'DD/MM/YYYY':
      return `${day}/${String(month).padStart(2, '0')}/${year}`;
    case 'DD MMM YYYY':
    default:
      return `${parseInt(day, 10)} ${MONTH_NAMES[month - 1] ?? ''} ${year}`;
  }
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

registerWidget('date_display', (container, config): WidgetInstance => {
  const timezone = (typeof config['timezone'] === 'string' && config['timezone'])
    ? config['timezone']
    : 'Asia/Singapore';
  const format = (typeof config['format'] === 'string' && config['format'])
    ? config['format']
    : 'DD MMM YYYY';

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
    span.textContent = formatDate(new Date(), timezone, format);
    midnightTimer = setTimeout(update, msUntilMidnight());
  }

  update();

  return {
    destroy() {
      if (midnightTimer !== null) clearTimeout(midnightTimer);
    },
  };
});
