/**
 * INV-6: No Content Amplification
 *
 * PRE cannot invent content. Every content_id in the output playlist must
 * be present in the input system_state (schedules, overrides, campaigns,
 * emergency, sponsorships) or be a constitutionally defined system content ID.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.6
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §3.6
 */

import { registerInvariant } from './index';
import {
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_EMERGENCY_FALLBACK_ID,
} from '../../pre/constants';

/** Content IDs that are constitutionally permitted even if not in system_state */
const SYSTEM_CONTENT_IDS = new Set([
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_EMERGENCY_FALLBACK_ID,
]);

registerInvariant({
  id: 'INV-6',
  description: 'Output content_ids are a subset of input content_ids (no content amplification)',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, input) {
    // Build the set of all content_ids present in the input state
    const activeContentIds = new Set<string>();

    // From schedules (direct content_id or campaign content)
    for (const schedule of input.system_state.schedules) {
      if (schedule.content_id) {
        activeContentIds.add(schedule.content_id);
      }
    }

    // From content_items (the canonical content registry)
    for (const item of input.system_state.content_items) {
      activeContentIds.add(item.id);
    }

    // From overrides
    for (const override of input.system_state.overrides) {
      activeContentIds.add(override.content_id);
    }

    // From emergency state
    if (input.system_state.emergency) {
      activeContentIds.add(input.system_state.emergency.content_id);
    }

    // From sponsorship contracts
    for (const contract of input.system_state.sponsorships) {
      activeContentIds.add(contract.content_id);
    }

    // Check each playlist item
    const amplifiedIds: string[] = [];
    for (const item of output.playlist) {
      if (
        !activeContentIds.has(item.content_id) &&
        !SYSTEM_CONTENT_IDS.has(item.content_id)
      ) {
        amplifiedIds.push(item.content_id);
      }
    }

    if (amplifiedIds.length > 0) {
      return {
        invariantId: 'INV-6',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `Content amplification detected: ${amplifiedIds.length} content_id(s) in output ` +
          `are not present in the input system_state or system content list: ` +
          `[${amplifiedIds.join(', ')}]. PRE cannot invent content.`,
        detail: {
          amplified_ids: amplifiedIds,
          active_content_ids: [...activeContentIds],
        },
      };
    }

    return {
      invariantId: 'INV-6',
      passed: true,
      severity: 'CONSTITUTIONAL_BREACH',
      message:
        `No amplification: all ${output.playlist.length} playlist content_ids ` +
        `are present in input system_state (${activeContentIds.size} active content_ids)`,
    };
  },
});
