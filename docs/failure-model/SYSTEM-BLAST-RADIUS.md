# ClubHub TV — System Blast Radius

| Subsystem | Failure Mode | Blast Radius | PRE Affected? |
|---|---|---|---|
| Entropy scheduler | Stops | Advisory degraded | No |
| Shadow runner | Stops | Parity accumulation halted | No |
| Replay harness | Nondeterministic | CLASS_4 declared | PRE halted |
| Audit writer | Stops | Gap in audit log | No |
| Preview API | Stops | Explainability unavailable | No |
| PRE resolver | Throws | CLASS_3/4 depending on cause | Yes |
| Invariant checker | Violation | CLASS_3 declared | PRE fallback |
| Emergency state | Incorrect | CLASS_4 (INV-7) | PRE halted |

## Notes

### Entropy Scheduler Stops
- No new entropy scores computed.
- Advisory tier frozen at last computed value.
- PRE resolution is not affected — entropy is advisory only.
- Classified as CLASS_2.

### Shadow Runner Stops
- Parity window accumulation halted.
- Existing parity score is preserved but becomes stale.
- PRE resolution continues unaffected.
- Must emit WARNING telemetry — cannot degrade silently.
- Classified as CLASS_2.

### Replay Harness Nondeterministic
- Same packet produces different output on consecutive runs.
- Replay system is untrusted — cannot verify correctness.
- Classified as CLASS_4 immediately.
- PRE is halted — cannot trust correctness without verifiable replay.

### Audit Writer Stops
- Gap in replay audit log.
- PRE resolution continues.
- Gaps must be logged and timestamped for later investigation.
- Classified as CLASS_2.

### Preview API Stops
- Operators cannot view future playlist predictions or explanations.
- No impact on PRE resolution or shadow comparison.
- Classified as CLASS_2 (advisory service degraded).

### PRE Resolver Throws
- If invariant violation: CLASS_3 — halt canary, serve legacy.
- If emergency precedence failure (INV-7): CLASS_4 — all-stop.
- If generic exception: CLASS_3 — investigate cause.

### Invariant Checker Violation
- Any invariant violation means PRE output is constitutionally invalid.
- Classified as CLASS_3 immediately.
- Canary halted, legacy path only.

### Emergency State Incorrect
- Emergency active but PRE produced non-zero resolution level (INV-7).
- Classified as CLASS_4 — emergency precedence is a safety invariant.
- Immediate all-stop.
