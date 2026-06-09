/**
 * LEVEL_4 — Sponsorship injection.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.4
 */
import type { PRE_Input, SponsorshipContractRecord, PlaylistItem, ReasonTraceSponsorshipLevel } from '../types';
export interface Level4Result {
    playlist: PlaylistItem[];
    trace: ReasonTraceSponsorshipLevel;
}
export declare function applyLevel4(input: PRE_Input, basePlaylist: PlaylistItem[], contracts: SponsorshipContractRecord[], skipSponsorship: boolean): Level4Result;
//# sourceMappingURL=level4-sponsorship.d.ts.map