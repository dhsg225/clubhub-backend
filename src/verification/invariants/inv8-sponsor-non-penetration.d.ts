/**
 * INV-8: Sponsorship Non-Penetration
 *
 * Sponsorship contracts (LEVEL_4) cannot push total sponsored share-of-voice
 * beyond the SOV warning threshold without triggering sov_warning_active.
 * Additionally, sponsorship injection cannot replace all campaign/override
 * content — it injects alongside, never instead of (except in structural fallback).
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.8
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §5 (Sponsorship Layer)
 *
 * Specific assertions:
 * 1. If total sponsor_pct > SOV_WARNING_THRESHOLD in the output,
 *    then sov_warning_active must be true in the trace.
 * 2. sponsor_pct in content_mix matches the actual fraction of sponsored items.
 * 3. Sponsored items are marked with sponsored=true in the playlist.
 */
export {};
//# sourceMappingURL=inv8-sponsor-non-penetration.d.ts.map