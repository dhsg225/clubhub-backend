export interface PromoSlideData {
  headline: string;
  subheadline?: string;
  image?: string;
}

export type SlideData = PromoSlideData;

export interface ManifestItem {
  content_id:        string;
  type:              string;   // widened from literal — player uses resolveRenderer
  data:              SlideData;
  duration:          number;
  // Optional fields added by manifest engine — player ignores unknown fields
  template_version?: number;
  priority?:         number;
  source?:           'scheduled' | 'fallback' | 'legacy' | 'system';
}

export interface Manifest {
  screen_id:    string;
  items:        ManifestItem[];
  version:      number;
  generated_at: string;
  // Optional fields from manifest engine — backward-compatible additions
  venue_id?:      string;
  checksum?:      string;
  computed_at?:   string;
  valid_until?:   string;
  fallback_items?: ManifestItem[];
}

export interface TemplateField {
  name:     string;
  label:    string;
  type:     'text' | 'image';
  required: boolean;
}

export interface TemplateDef {
  type:    string;
  name:    string;
  fields:  TemplateField[];
}
