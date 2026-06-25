/**
 * Layout engine — renders a CSS grid layout and runs per-zone playlist rotations.
 * Reads layout definitions from layout-definitions.ts and widget registry from widget-registry.ts.
 * No widget logic is hardcoded here (D-017).
 *
 * D-015 / D-016 vocabulary:
 *   Layout  — the named CSS grid geometry
 *   Zone    — a named grid area (receives cards OR widgets)
 *   Card    — rendered authored content (via renderCard)
 *   Widget  — programmatic real-time display (via widget registry)
 *
 * Constitutional: layout engine never overrides emergency overlay logic in index.ts.
 */

import { renderCard } from './template-stubs.js';
import { getLayoutDefinition } from './layout-definitions.js';
import { instantiateWidget, type WidgetInstance } from './widget-registry.js';

// Trigger widget self-registration on import
import './widgets/clock.js';
import './widgets/date-display.js';
import './widgets/ticker-scroll.js';

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

// Active per-zone rotation timers — cleared before each re-render
let activeTimers: ReturnType<typeof setTimeout>[] = [];
// Active widget instances — destroyed before each re-render
let activeWidgets: WidgetInstance[] = [];

export function renderLayout(
  container: HTMLElement,
  screenLayout: string,
  zones: Record<string, PlaylistItem[]>,
  corpusData: Record<string, unknown> = {},
): void {
  // Destroy previous widget instances
  for (const w of activeWidgets) w.destroy();
  activeWidgets = [];

  // Clear any running rotations
  for (const t of activeTimers) clearTimeout(t);
  activeTimers = [];

  const layoutDef = getLayoutDefinition(screenLayout, corpusData);

  // Build outer grid
  container.innerHTML = '';
  container.style.cssText = [
    'width:100%', 'height:100%',
    'display:grid',
    `grid-template-areas:${layoutDef.grid_areas}`,
    `grid-template-rows:${layoutDef.grid_rows}`,
    `grid-template-columns:${layoutDef.grid_cols}`,
    'overflow:hidden',
    'background:#000',
  ].join(';');

  // Collect all zone names from playlist_zones + widget_slots
  const allZones = new Set<string>([
    ...layoutDef.playlist_zones,
    ...layoutDef.widget_slots.map(s => s.zone),
  ]);

  // Map: zoneName → div element
  const zoneDivs = new Map<string, HTMLElement>();

  for (const zoneName of allZones) {
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
    zoneDivs.set(zoneName, zoneDiv);

    // Start card rotation for playlist zones
    if (layoutDef.playlist_zones.includes(zoneName)) {
      const items = zones[zoneName] ?? [];
      if (items.length > 0) startZoneRotation(zoneDiv, items);
    }
  }

  // Wire widget slots — subdivide zone divs as needed
  // Group slots by zone so we only split each zone div once
  const slotsByZone = new Map<string, typeof layoutDef.widget_slots>();
  for (const slot of layoutDef.widget_slots) {
    const existing = slotsByZone.get(slot.zone) ?? [];
    existing.push(slot);
    slotsByZone.set(slot.zone, existing);
  }

  for (const [zoneName, slots] of slotsByZone) {
    const zoneDiv = zoneDivs.get(zoneName);
    if (!zoneDiv) continue;

    const hasLeftFixed = slots.some(s => s.position === 'left-fixed');

    if (hasLeftFixed) {
      // Split the zone div into a left sub-div (fixed width) and right sub-div (fill)
      zoneDiv.style.cssText += ';display:flex;flex-direction:row;align-items:stretch;';

      for (const slot of slots) {
        const subDiv = document.createElement('div');

        if (slot.position === 'left-fixed') {
          subDiv.style.cssText = [
            `width:${slot.width ?? 120}px`,
            'flex-shrink:0',
            'height:100%',
            'overflow:hidden',
            'display:flex',
            'align-items:center',
            'justify-content:center',
          ].join(';');
        } else {
          // fill
          subDiv.style.cssText = [
            'flex:1',
            'min-width:0',
            'height:100%',
            'overflow:hidden',
          ].join(';');
        }

        zoneDiv.appendChild(subDiv);

        const config: Record<string, unknown> = {
          ...(slot as any).config ?? {},
          ...(slot.corpus_key ? { items: corpusData[slot.corpus_key] ?? [] } : {}),
        };
        const instance = instantiateWidget(slot.widget, subDiv, config);
        activeWidgets.push(instance);
      }
    } else {
      // Non-split: give each slot the full zone div (last slot wins if multiple)
      for (const slot of slots) {
        const config: Record<string, unknown> = {
          ...(slot as any).config ?? {},
          ...(slot.corpus_key ? { items: corpusData[slot.corpus_key] ?? [] } : {}),
        };
        const instance = instantiateWidget(slot.widget, zoneDiv, config);
        activeWidgets.push(instance);
      }
    }
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
