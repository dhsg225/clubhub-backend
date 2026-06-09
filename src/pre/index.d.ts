/**
 * PRE.resolve() — Playback Resolution Engine
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md
 *
 * CRITICAL CONSTRAINTS:
 *   - assertTotalOrdering() MUST run on every playlist before output
 *   - runAllInvariants() MUST run on every PRE_Output before return
 *   - Use input.at only — never Date.now()
 *   - No side effects of any kind
 */
import type { PRE_Input, PRE_Output } from './types';
import '../verification/invariants/inv1-purity';
import '../verification/invariants/inv2-totality';
import '../verification/invariants/inv3-determinism';
import '../verification/invariants/inv4-monotone-version';
import '../verification/invariants/inv5-level-termination';
import '../verification/invariants/inv6-no-amplification';
import '../verification/invariants/inv7-emergency-absolute';
import '../verification/invariants/inv8-sponsor-non-penetration';
import '../verification/invariants/inv9-timezone-isolation';
import '../verification/invariants/inv10-output-completeness';
export declare function resolve(input: PRE_Input): PRE_Output;
//# sourceMappingURL=index.d.ts.map