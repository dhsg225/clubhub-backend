/**
 * INV-7: Emergency Absoluteness
 *
 * When an active emergency state exists for a venue, the PRE output MUST
 * resolve at LEVEL_0 (Emergency). No other resolution level is permitted
 * when an emergency is active. The emergency content_id must be the sole
 * content item in the playlist.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.7
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §4.1 (Level 0 Emergency)
 *
 * This is the hardest invariant: it admits NO exceptions.
 * Not override priority, not sponsorship contracts, not fallback behavior.
 * Emergency absolutely takes precedence over all other resolution sources.
 */

import { registerInvariant } from './index';
import { RESOLUTION_LEVELS } from '../../pre/types';

registerInvariant({
  id: 'INV-7',
  description: 'Active emergency forces LEVEL_0 resolution exclusively; emergency content is sole output',
  severity: 'CATASTROPHIC',
  assert(output, input) {
    const emergency = input.system_state.emergency;

    // If no emergency exists, this invariant is vacuously satisfied
    if (!emergency || !emergency.is_active) {
      return {
        invariantId: 'INV-7',
        passed: true,
        severity: 'CATASTROPHIC',
        message: 'No active emergency: INV-7 vacuously satisfied',
      };
    }

    // Emergency is active — enforce absoluteness

    // 1. Must resolve at LEVEL_0
    if (output.resolution_level !== RESOLUTION_LEVELS.LEVEL_0_EMERGENCY) {
      return {
        invariantId: 'INV-7',
        passed: false,
        severity: 'CATASTROPHIC',
        message:
          `CATASTROPHIC: Active emergency (id="${emergency.id}") exists but PRE resolved at ` +
          `LEVEL_${output.resolution_level} instead of LEVEL_0. ` +
          `Emergency absoluteness requires LEVEL_0 resolution whenever an emergency is active. ` +
          `This is a CATASTROPHIC constitutional violation.`,
        detail: {
          emergency_id: emergency.id,
          emergency_content_id: emergency.content_id,
          actual_resolution_level: output.resolution_level,
        },
      };
    }

    // 2. Playlist must contain the emergency content_id
    if (output.playlist.length === 0) {
      return {
        invariantId: 'INV-7',
        passed: false,
        severity: 'CATASTROPHIC',
        message:
          `CATASTROPHIC: Active emergency (id="${emergency.id}") resolved at LEVEL_0 ` +
          `but produced an empty playlist. Emergency content_id "${emergency.content_id}" ` +
          `must be in the playlist.`,
      };
    }

    // 3. Emergency content_id must be present in the playlist
    const hasEmergencyContent = output.playlist.some(
      item => item.content_id === emergency.content_id
    );

    if (!hasEmergencyContent) {
      return {
        invariantId: 'INV-7',
        passed: false,
        severity: 'CATASTROPHIC',
        message:
          `CATASTROPHIC: Active emergency (id="${emergency.id}") resolved at LEVEL_0 ` +
          `but playlist does not contain emergency content_id "${emergency.content_id}". ` +
          `Playlist contains: [${output.playlist.map(i => i.content_id).join(', ')}].`,
        detail: {
          emergency_content_id: emergency.content_id,
          playlist_content_ids: output.playlist.map(i => i.content_id),
        },
      };
    }

    // 4. Non-emergency content must NOT be present (sponsorship injection is forbidden during emergency)
    const nonEmergencyItems = output.playlist.filter(
      item => item.content_id !== emergency.content_id
    );

    if (nonEmergencyItems.length > 0) {
      return {
        invariantId: 'INV-7',
        passed: false,
        severity: 'CATASTROPHIC',
        message:
          `CATASTROPHIC: Active emergency playlist contains ${nonEmergencyItems.length} ` +
          `non-emergency content item(s). During an emergency, only the emergency content ` +
          `may appear in the playlist. Sponsorship injection (INV-8) does not override emergency (INV-7). ` +
          `Non-emergency items: [${nonEmergencyItems.map(i => i.content_id).join(', ')}]`,
        detail: {
          emergency_content_id: emergency.content_id,
          non_emergency_ids: nonEmergencyItems.map(i => i.content_id),
        },
      };
    }

    return {
      invariantId: 'INV-7',
      passed: true,
      severity: 'CATASTROPHIC',
      message:
        `Emergency absoluteness holds: LEVEL_0 resolution, ` +
        `emergency content "${emergency.content_id}" is sole playlist item`,
    };
  },
});
