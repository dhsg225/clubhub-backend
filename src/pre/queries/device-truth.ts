/**
 * Query: device-truth
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */

import type { SystemStateSnapshot, ScreenDeliveryLogRecord } from '../types';

/**
 * Return the last known delivery log record for this screen.
 * Returns null if no delivery has been recorded.
 */
export function getLastDelivery(
  state: SystemStateSnapshot
): ScreenDeliveryLogRecord | null {
  return state.last_delivery ?? null;
}
