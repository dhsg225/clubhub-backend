'use strict';

const express    = require('express');
const crypto     = require('node:crypto');
const { pool }   = require('../db');
const { getManifest } = require('../lib/manifestEngine');

const router = express.Router();

// GET /resolve/:screen_id
// Adapter for player-runtime PlaylistPoller — transforms manifest into ResolvedPlaylist shape.
// BL-029: includes screen_layout (from screens table) and zones map (items grouped by zone_name).
router.get('/:screen_id', async (req, res) => {
  const { screen_id } = req.params;
  if (!screen_id || screen_id.length > 100) {
    return res.status(400).json({ error: 'invalid screen_id' });
  }

  try {
    const [manifest, screenRow, tickerRow] = await Promise.all([
      getManifest(screen_id),
      pool.query('SELECT screen_layout FROM screens WHERE id = $1', [screen_id]),
      pool.query(
        'SELECT text FROM ticker_items WHERE screen_id = $1 AND active = true ORDER BY display_order ASC, created_at ASC',
        [screen_id]
      ),
    ]);

    const screen_layout = screenRow.rows[0]?.screen_layout ?? 'fullscreen';

    // BL-048: join layout definition from layouts table
    const layoutRow = await pool.query('SELECT definition FROM layouts WHERE slug = $1', [screen_layout]);
    const layout_definition = layoutRow.rows[0]?.definition ?? null;
    const ticker_items = tickerRow.rows.map(r => r.text);

    // Flat playlist (backward compat — all items regardless of zone)
    const playlist = (manifest.items ?? []).map(item => ({
      content_id:    item.content_id,
      duration_ms:   (item.duration ?? 10) * 1000,
      template_type: item.type,
      data:          item.data ?? {},
      zone_name:     item.zone_name ?? 'main',
      weight:        item.weight ?? 1,
      source:        0,
      sponsored:     item.sponsored ?? false,
    }));

    // Zone map — each key is a zone name, value is array of PlaylistItems for that zone
    const zones = {};
    for (const [zoneName, zoneItems] of Object.entries(manifest.items_by_zone ?? {})) {
      zones[zoneName] = zoneItems.map(item => ({
        content_id:    item.content_id,
        duration_ms:   (item.duration ?? 10) * 1000,
        template_type: item.type,
        data:          item.data ?? {},
        zone_name:     item.zone_name ?? 'main',
        weight:        item.weight ?? 1,
        source:        0,
        sponsored:     item.sponsored ?? false,
      }));
    }

    // Ensure 'main' zone always present (fallback for layouts that only use main)
    if (!zones['main'] && playlist.length > 0) {
      zones['main'] = playlist;
    }

    const resolved = {
      screen_id,
      screen_layout,
      ...(layout_definition ? { layout_definition } : {}),
      ticker_items,
      resolved_at:       Date.now(),
      resolution_level:  (manifest.items?.length ?? 0) > 0 ? 1 : 0,
      is_fallback:       manifest.items?.every(i => i.source === 'fallback') ?? false,
      playlist_checksum: manifest.checksum ?? crypto.randomUUID(),
      playlist,
      zones,
      _meta: {
        correlation_id: req.headers['x-correlation-id'] ?? crypto.randomUUID(),
        at_utc_ms:      Date.now(),
        venue_id:       manifest.venue_id ?? '',
      },
    };

    res.json(resolved);
  } catch (err) {
    console.error('GET /resolve:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
