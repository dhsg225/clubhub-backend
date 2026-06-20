/**
 * Layout engine — renders a CSS grid layout and runs per-zone playlist rotations.
 *
 * D-015 / D-016 vocabulary:
 *   Layout  — the named CSS grid geometry (fullscreen, split_horizontal, news_bar, quad)
 *   Zone    — a named grid area that receives either a card playlist or a widget
 *   Card    — a rendered piece of authored content (dispatched via renderCard)
 *   Widget  — a programmatic real-time display (BL-032 — not yet wired here)
 *
 * Constitutional: layout engine never overrides emergency overlay logic in index.ts.
 */

import { renderCard } from './template-stubs.js';

interface PlaylistItem {
  content_id: string;
  duration_ms: number;
  template_type?: string;
  data?: Record<string, unknown>;
  asset_path?: string;
  zone_name?: string;
  weight?: number;
  source?: number;
  sponsored?: boolean;
}

interface LayoutConfig {
  grid_template_areas: string;
  grid_template_rows: string;
  grid_template_columns: string;
  zones: string[];          // all named grid areas
  playlist_zones: string[]; // zones that receive card rotation (vs widget zones)
}

const LAYOUTS: Record<string, LayoutConfig> = {
  fullscreen: {
    grid_template_areas:   '"main"',
    grid_template_rows:    '1fr',
    grid_template_columns: '1fr',
    zones:          ['main'],
    playlist_zones: ['main'],
  },
  split_horizontal: {
    grid_template_areas:   '"main_left main_right" "ticker ticker"',
    grid_template_rows:    '90% 10%',
    grid_template_columns: '1fr 1fr',
    zones:          ['main_left', 'main_right', 'ticker'],
    playlist_zones: ['main_left', 'main_right'],
  },
  news_bar: {
    grid_template_areas:   '"main" "ticker"',
    grid_template_rows:    '90% 10%',
    grid_template_columns: '1fr',
    zones:          ['main', 'ticker'],
    playlist_zones: ['main'],
  },
  quad: {
    grid_template_areas:   '"top_left top_right" "bottom_left bottom_right"',
    grid_template_rows:    '1fr 1fr',
    grid_template_columns: '1fr 1fr',
    zones:          ['top_left', 'top_right', 'bottom_left', 'bottom_right'],
    playlist_zones: ['top_left', 'top_right', 'bottom_left', 'bottom_right'],
  },
};

// Active per-zone rotation timers — cleared before each re-render
let activeTimers: ReturnType<typeof setTimeout>[] = [];

export function renderLayout(
  container: HTMLElement,
  screenLayout: string,
  zones: Record<string, PlaylistItem[]>,
): void {
  // Clear any running rotations from previous render
  for (const t of activeTimers) clearTimeout(t);
  activeTimers = [];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const layout: LayoutConfig = LAYOUTS[screenLayout] ?? LAYOUTS['fullscreen']!;

  // Build outer grid
  container.innerHTML = '';
  container.style.cssText = [
    'width:100%', 'height:100%',
    'display:grid',
    `grid-template-areas:${layout.grid_template_areas}`,
    `grid-template-rows:${layout.grid_template_rows}`,
    `grid-template-columns:${layout.grid_template_columns}`,
    'overflow:hidden',
    'background:#000',
  ].join(';');

  // Create a div per zone
  for (const zoneName of layout.zones) {
    const zoneDiv = document.createElement('div');
    zoneDiv.dataset['zone'] = zoneName;
    zoneDiv.style.cssText = [
      `grid-area:${zoneName}`,
      'container-type:inline-size',
      'container-name:zone',
      'width:100%',
      'height:100%',
      'position:relative',
      'overflow:hidden',
    ].join(';');
    container.appendChild(zoneDiv);

    // Only playlist_zones get card rotation
    if (!layout.playlist_zones.includes(zoneName)) continue;

    const items = zones[zoneName] ?? [];
    if (items.length === 0) continue;

    startZoneRotation(zoneDiv, items);
  }
}

function startZoneRotation(zoneDiv: HTMLElement, items: PlaylistItem[]): void {
  let index = 0;

  function showNext(): void {
    const item = items[index % items.length];
    if (!item) return;

    displayItem(zoneDiv, item);
    index = (index + 1) % items.length;

    const timer = setTimeout(showNext, item.duration_ms);
    activeTimers.push(timer);
  }

  showNext();
}

function displayItem(container: HTMLElement, item: PlaylistItem): void {
  container.innerHTML = '';

  // Data-driven template card
  if (item.template_type && !item.asset_path) {
    renderCard(container, item.template_type, item.data ?? {}, item.content_id);
    return;
  }

  if (!item.asset_path) return;

  if (item.asset_path.endsWith('.mp4') || item.asset_path.endsWith('.webm')) {
    const video = document.createElement('video');
    video.src = item.asset_path;
    video.autoplay = true;
    video.muted = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    container.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = item.asset_path;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    container.appendChild(img);
  }
}
