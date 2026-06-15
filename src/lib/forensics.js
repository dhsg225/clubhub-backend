'use strict';
/**
 * forensics.js
 *
 * Forensic bundle export for ClubHub TV.
 * Implements OBSERVABILITY.md §7 forensic reconstruction requirements.
 *
 * Exports the in-memory event buffer to a timestamped JSON file for
 * incident post-mortem analysis.
 *
 * Usage:
 *   const { exportBundle, incidentSnapshot } = require('./forensics');
 *
 *   // On P1 incident:
 *   const bundlePath = await exportBundle({ reason: 'all_screens_dark' });
 *
 *   // Snapshot for a specific screen + time window:
 *   const snap = incidentSnapshot({ screen_id: 'sim-01', windowMs: 300_000 });
 */

const fs   = require('node:fs');
const path = require('node:path');
const { getBuffer } = require('./events');

const INCIDENTS_DIR = path.resolve(process.cwd(), 'docs/incidents');

/**
 * Export the full in-memory event buffer to a timestamped JSON file.
 * File written to docs/incidents/YYYY-MM-DD-<reason>.json
 *
 * @param {object} opts
 * @param {string} opts.reason    Short slug for the incident (e.g. 'all_screens_dark')
 * @param {object} [opts.meta]    Additional metadata to include in the bundle
 * @returns {string}  Absolute path of the written bundle
 */
async function exportBundle({ reason = 'incident', meta = {} } = {}) {
  const events = getBuffer();
  const ts     = new Date().toISOString().slice(0, 10);
  const slug   = reason.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const fname  = `${ts}-${slug}.json`;

  if (!fs.existsSync(INCIDENTS_DIR)) {
    fs.mkdirSync(INCIDENTS_DIR, { recursive: true });
  }

  const filePath = path.join(INCIDENTS_DIR, fname);
  const bundle = {
    exported_at:   new Date().toISOString(),
    reason,
    event_count:   events.length,
    meta,
    // OBSERVABILITY.md §7: reconstructing timeline requires these fields
    coverage: {
      earliest: events[0]?.ts ?? null,
      latest:   events[events.length - 1]?.ts ?? null,
    },
    events,
  };

  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2));
  return filePath;
}

/**
 * Return a filtered snapshot of the buffer for a specific screen
 * within a recent time window.
 *
 * @param {object} opts
 * @param {string} [opts.screen_id]   Filter by screen (null = all screens)
 * @param {number} [opts.windowMs]    Look-back window in ms (default: 300_000 = 5 min)
 * @returns {object}  { screen_id, from, to, events }
 */
function incidentSnapshot({ screen_id = null, windowMs = 300_000 } = {}) {
  const events  = getBuffer();
  const cutoff  = new Date(Date.now() - windowMs).toISOString();
  const filtered = events.filter(ev => {
    if (ev.ts < cutoff) return false;
    if (screen_id && ev.screen_id !== screen_id) return false;
    return true;
  });

  return {
    screen_id:   screen_id ?? 'all',
    from:        cutoff,
    to:          new Date().toISOString(),
    event_count: filtered.length,
    events:      filtered,
  };
}

module.exports = { exportBundle, incidentSnapshot };
