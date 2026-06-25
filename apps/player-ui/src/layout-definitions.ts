/**
 * Layout definitions (D-017 / BL-048).
 *
 * Each layout describes:
 *   - CSS grid geometry (grid_areas, grid_rows, grid_cols)
 *   - playlist_zones — zones that receive card rotation
 *   - widget_slots — zones that receive registered widgets
 *
 * Widget slot positions:
 *   left-fixed  — occupies a fixed-width left sub-div within the zone
 *   fill        — occupies the remaining space to the right of any left-fixed widget
 *   full        — occupies the entire zone div
 *
 * BL-048: LAYOUTS is now a hardcoded fallback. Production reads layout_definition
 * from the /resolve corpus response. If absent (old Pi, stale cache), falls back
 * to the matching hardcoded entry by slug.
 */

export interface WidgetSlot {
  zone: string;
  position: 'left-fixed' | 'fill' | 'full';
  width?: number;       // px — only used when position === 'left-fixed'
  widget: string;       // registry key
  corpus_key?: string;  // key in /resolve response passed as config.items to widget
}

export interface LayoutDefinition {
  grid_areas: string;
  grid_rows: string;
  grid_cols: string;
  playlist_zones: string[];
  widget_slots: WidgetSlot[];
}

/** Hardcoded fallback — used only when corpus.layout_definition is absent. */
const FALLBACK_LAYOUTS: Record<string, LayoutDefinition> = {
  fullscreen: {
    grid_areas:     '"main"',
    grid_rows:      '1fr',
    grid_cols:      '1fr',
    playlist_zones: ['main'],
    widget_slots:   [],
  },
  split_horizontal: {
    grid_areas:     '"main_left main_right" "ticker ticker"',
    grid_rows:      '90% 10%',
    grid_cols:      '1fr 1fr',
    playlist_zones: ['main_left', 'main_right'],
    widget_slots: [
      { zone: 'ticker', position: 'left-fixed', width: 120, widget: 'clock' },
      { zone: 'ticker', position: 'fill', widget: 'ticker_scroll', corpus_key: 'ticker_items' },
    ],
  },
  news_bar: {
    grid_areas:     '"main" "ticker"',
    grid_rows:      '90% 10%',
    grid_cols:      '1fr',
    playlist_zones: ['main'],
    widget_slots: [
      { zone: 'ticker', position: 'left-fixed', width: 120, widget: 'clock' },
      { zone: 'ticker', position: 'fill', widget: 'ticker_scroll', corpus_key: 'ticker_items' },
    ],
  },
  quad: {
    grid_areas:     '"top_left top_right" "bottom_left bottom_right"',
    grid_rows:      '1fr 1fr',
    grid_cols:      '1fr 1fr',
    playlist_zones: ['top_left', 'top_right', 'bottom_left', 'bottom_right'],
    widget_slots:   [],
  },
};

/** Backward-compat export — the hardcoded object. */
export const LAYOUTS = FALLBACK_LAYOUTS;

/**
 * Get the layout definition for the current screen.
 *
 * Priority:
 * 1. corpusData.layout_definition (from /resolve → layouts table JSONB)
 * 2. Hardcoded fallback by screenLayout slug
 * 3. Hardcoded fullscreen as safe default
 */
export function getLayoutDefinition(
  screenLayout: string,
  corpusData: Record<string, unknown> = {},
): LayoutDefinition {
  // 1. Corpus-provided definition (DB-backed, dynamic)
  const corpusDef = corpusData['layout_definition'];
  if (corpusDef && typeof corpusDef === 'object' && !Array.isArray(corpusDef)) {
    const def = corpusDef as Record<string, unknown>;
    if (typeof def['grid_areas'] === 'string' && Array.isArray(def['playlist_zones'])) {
      return def as unknown as LayoutDefinition;
    }
  }

  // 2. Hardcoded fallback by slug
  // 3. Fullscreen as safe default
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return FALLBACK_LAYOUTS[screenLayout] ?? FALLBACK_LAYOUTS['fullscreen']!;
}
