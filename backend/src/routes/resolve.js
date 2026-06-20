'use strict';

const express = require('express');
const crypto  = require('node:crypto');
const { getManifest } = require('../lib/manifestEngine');

const router = express.Router();

// GET /resolve/:screen_id
// Adapter for player-runtime PlaylistPoller — transforms manifest into ResolvedPlaylist shape.
router.get('/:screen_id', async (req, res) => {
  const { screen_id } = req.params;
  if (!screen_id || screen_id.length > 100) {
    return res.status(400).json({ error: 'invalid screen_id' });
  }

  try {
    const manifest = await getManifest(screen_id);

    const playlist = (manifest.items ?? []).map(item => ({
      content_id:  item.content_id,
      duration_ms: (item.duration ?? 10) * 1000,
      weight:      item.weight ?? 1,
      source:      0,
      sponsored:   item.sponsored ?? false,
    }));

    const resolved = {
      screen_id,
      resolved_at:       Date.now(),
      resolution_level:  (manifest.items?.length ?? 0) > 0 ? 1 : 0,
      is_fallback:       manifest.items?.every(i => i.source === 'fallback') ?? false,
      playlist_checksum: manifest.checksum ?? crypto.randomUUID(),
      playlist,
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
