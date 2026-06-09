/**
 * Query: sponsorship-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
import type { SystemStateSnapshot, SponsorshipContractRecord } from '../types';
/**
 * Return all sponsorship contracts that are:
 *   - is_active === true
 *   - starts_at <= at
 *   - expires_at === null || expires_at > at
 *   - area_id matches state.area?.id (sponsorships are area-scoped)
 *
 * Returns empty array if state.area is null (no area = no sponsorship possible).
 */
export declare function getActiveSponsorships(state: SystemStateSnapshot, at: number): SponsorshipContractRecord[];
//# sourceMappingURL=sponsorship-state.d.ts.map