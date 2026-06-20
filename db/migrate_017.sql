-- migrate_017.sql
-- BL-044: Add media_url image field to sponsor_banner template schema
BEGIN;

UPDATE card_templates
SET field_schema = jsonb_set(
  field_schema,
  '{fields}',
  (field_schema->'fields') || '[{"key": "media_url", "label": "Banner Image", "type": "image", "required": false}]'::jsonb
)
WHERE type_slug = 'sponsor_banner'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(field_schema->'fields') AS f
    WHERE f->>'key' = 'media_url'
  );

COMMIT;
