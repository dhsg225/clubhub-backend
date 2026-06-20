-- migrate_011: rename layout_template → screen_layout on screens table (D-016 vocabulary)
-- "template" is reserved for card template_type; screen geometry is a "layout"
ALTER TABLE screens RENAME COLUMN layout_template TO screen_layout;
