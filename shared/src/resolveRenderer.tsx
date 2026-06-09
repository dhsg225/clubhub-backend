import React from 'react';
import { PromoSlideRenderer } from './PromoSlideRenderer';

// Renderer contract: every registered component receives `data` as an unknown record.
// It is the renderer's responsibility to cast/validate its own fields.
type AnyRenderer = React.ComponentType<{ data: Record<string, unknown> }>;

// Registry key format: 'template_type:version'
// To add a new template: import the component and add an entry.
// To create a breaking change: add a new version entry, leave v1 intact.
const REGISTRY: Record<string, AnyRenderer> = {
  // `as unknown as AnyRenderer` is intentional: each renderer validates its own data at runtime.
  // The registry erases specific prop types to allow heterogeneous template storage.
  'promo_slide:1': PromoSlideRenderer as unknown as AnyRenderer,
};

/**
 * Resolves a renderer for the given template type and version.
 *
 * Resolution order:
 *   1. Exact match:  `type:version`
 *   2. Version 1:    `type:1`
 *   3. null          (unknown type — caller must handle gracefully)
 */
export function resolveRenderer(type: string, version = 1): AnyRenderer | null {
  return (
    REGISTRY[`${type}:${version}`] ??
    REGISTRY[`${type}:1`]          ??
    null
  );
}
