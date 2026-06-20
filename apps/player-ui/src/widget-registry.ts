/**
 * Widget Registry (D-017)
 *
 * Widgets self-register on import. The layout engine calls instantiateWidget()
 * by name — it never contains widget logic directly.
 *
 * Adding a new widget:
 *   1. Create apps/player-ui/src/widgets/<name>.ts
 *   2. Call registerWidget('<key>', factory) in that file
 *   3. Add a widget_slot entry in layout-definitions.ts for the desired layout
 *   Layout engine needs no changes.
 */

export interface WidgetInstance {
  destroy(): void;
  update?(data: unknown): void;
}

type WidgetFactory = (
  container: HTMLElement,
  config: Record<string, unknown>,
) => WidgetInstance;

const registry = new Map<string, WidgetFactory>();

export function registerWidget(name: string, factory: WidgetFactory): void {
  registry.set(name, factory);
}

export function instantiateWidget(
  name: string,
  container: HTMLElement,
  config: Record<string, unknown>,
): WidgetInstance {
  const factory = registry.get(name);
  if (!factory) {
    // Unknown widget — mount nothing, return no-op instance
    console.warn(`[widget-registry] Unknown widget: "${name}"`);
    return { destroy() { /* no-op */ } };
  }
  return factory(container, config);
}
