import type { TemplateDef } from './types';

export const PROMO_SLIDE: TemplateDef = {
  type: 'promo_slide',
  name: 'Promo Slide',
  fields: [
    { name: 'headline',    label: 'Headline',     type: 'text',  required: true  },
    { name: 'subheadline', label: 'Sub-headline',  type: 'text',  required: false },
    { name: 'image',       label: 'Image URL',     type: 'image', required: false },
  ],
};

export const TEMPLATE_REGISTRY: Record<string, TemplateDef> = {
  promo_slide: PROMO_SLIDE,
};
