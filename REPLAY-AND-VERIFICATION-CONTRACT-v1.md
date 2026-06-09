# REPLAY-AND-VERIFICATION-CONTRACT-v1

**Status:** AUTHORITATIVE
**Scope:** What constitutes a valid replay, divergence detection, acceptable vs unacceptable divergence, deterministic reconstruction, canonical comparison, failure classification
**Governing principle:** Replay is the source of truth. Nothing else.

---

## 1. WHAT CONSTITUTES A VALID REPLAY

A replay is valid if and only if all of the following are true:

1. **Input completeness:** The corpus entry stores the complete PREInput at the recorded moment — rule_version, override_stack, schedule_block, emergency state, device_state, governed_timestamp. Entries storing only the output are invalid.

2. **Output reproducibility:** Running the PRE resolution function against the stored PREInput with the stored rule_version produces an output whose `output_hash` matches the corpus-recorded `output_hash`.

3. **Clock authority:** All timestamps in the corpus entry use GovernedClock values from the original execution. No wall-clock timestamps are present.

4. **Trace completeness:** A `PRETraceEvent(PRE_RESOLVED)` exists in the append-only trace store for the corpus entry's `trace_id`, with matching `input_hash` and `output_hash`.

5. **Sequence integrity:** The corpus entry exists in the hash chain. Its `prior_entry_hash` matches the `output_hash` of the previous entry in the sequence for the same scope.

6. **Resolution path completeness:** The stored `resolution_path` contains every evaluated step in order. No steps are omitted.

A replay that fails any of the above is **invalid**. Invalid replays must not be presented to operators as authoritative records. They must be labeled as UNAVAILABLE.

---

## 2. DIVERGENCE DETECTION

Divergence is detected by comparing a new PRE execution against the corpus-recorded execution for the same input.

**Detection method:**
```
1. Load corpus entry (PREInput + recorded PREOutput)
2. Re-run PRE resolution on stored PREInput with stored rule_version
3. Compute SHA-256 of canonicalJSON(newOutput) excluding output_hash field
4. Compare to corpus-recorded output_hash
5. If hashes differ → DIVERGENCE DETECTED
6. If hashes match → NO DIVERGENCE
```

**Additional resolution path comparison (required when output_hash matches):**
Even when output hashes match, compare resolution_path step-by-step. A hash collision producing matching outputs through different paths is a CLASS_2 divergence (see Section 5).

**Divergence detection must run:**
- On every PR touching a `@replay-sensitive` module (per AUTOMATED-CONSTITUTIONAL-VALIDATION-v1.md)
- Nightly against the full corpus on the main branch
- On demand for any operator-requested corpus verification

---

## 3. ACCEPTABLE vs UNACCEPTABLE DIVERGENCE

### Acceptable (non-blocking with explicit documentation)

| Type | Condition | Required documentation |
|------|-----------|------------------------|
| Approved semantic change | rule_version has been incremented; corpus updated to reflect new expected outputs; change governance record exists | CC-4 constitutional change record + updated corpus |
| Explanation text change | output_hash unchanged; resolution_path step results unchanged; only human-readable `reason` strings changed | Agent 3 review record |
| New corpus entry | A new corpus entry is added; no existing entries are affected | CC-2 behavioral change record |

### Unacceptable (unconditionally deployment-blocking)

| Type | Condition |
|------|-----------|
| Unexplained output divergence | output_hash differs from corpus with no approved change record |
| Resolution path mutation | Step results differ (WIN/SUPPRESSED/EXPIRED/OUT_OF_SCOPE) with no approved change record |
| Effective content change | effective_content differs from corpus record with no approved change record |
| Resolution level change | resolution_level differs from corpus record with no approved change record |
| Clock contamination | A corpus entry is found to contain wall-clock timestamps |
| Input incompleteness | A corpus entry missing any required PREInput field cannot be replayed |

---

## 4. DETERMINISTIC RECONSTRUCTION RULES

A reconstruction is valid only when:

1. **Same rule_version:** The PRE resolution function version used for reconstruction must match the version recorded in the corpus entry. If the current rule_version differs, the historical version must be loaded.

2. **Immutable inputs:** PREInput is loaded from the corpus without modification. No field may be updated, defaulted, or inferred.

3. **GovernedClock frozen:** GovernedClock is set to the corpus entry's `governed_timestamp` and does not advance during the reconstruction computation.

4. **Pure execution:** The reconstruction runs the same pure resolution function (Steps 1–8 of MINIMAL-PRE-RUNNER-SPEC-v1.md) with no I/O, no side effects, no external reads.

5. **Hash verification:** Both input_hash and output_hash are recomputed and compared to corpus records. Both must match.

6. **Determinism confirmation:** Reconstruction must be run N=5 times. All N output_hash values must be identical. Any variation is a `DETERMINISM_VIOLATION` failure.

---

## 5. CANONICAL COMPARISON METHOD

The canonical comparison is a hash comparison. Human-readable diff is supplementary.

**Primary comparison:**
```
stored_output_hash == SHA-256(canonicalJSON(newOutput excluding output_hash field))
```

**Canonical JSON definition:**
- Object keys sorted lexicographically at every nesting level
- No whitespace (no spaces, no newlines)
- String values: UTF-8, no normalization beyond standard JSON encoding
- Number values: exact; no floating-point rounding
- Null values: included as `null` (not omitted)
- Array order: preserved as-is (arrays are ordered data)

**Secondary comparison (when hash differs):**
1. Decompose both outputs into fields
2. Compare field-by-field: `effective_content`, `resolution_level`, `resolution_winner_id`, `resolution_path`
3. Report which fields differ for failure classification

**Explanation comparison (required for explanation parity):**
The explanation produced for a corpus entry in live context and in replay context must be identical. Same PRE input → same explanation. This is verified by comparing the full `resolution_path` step-by-step, not just the output hash.

---

## 6. FAILURE CLASSIFICATION (5 categories)

### CLASS_1: DETERMINISM FAILURE
**Definition:** The PRE produces different `output_hash` values for identical inputs across multiple runs.
**Severity:** CRITICAL
**Action:** Immediate halt. No new merges to the PRE module. Must be resolved before any deployment. The `DETERMINISM_VIOLATION` failure code is emitted.
**Detection:** Run PRE 5 times on the same input; any differing hash is CLASS_1.

---

### CLASS_2: CORPUS DIVERGENCE
**Definition:** A code change causes PRE output to differ from one or more canonical corpus entries, without an approved corpus update.
**Severity:** CRITICAL
**Action:** Deployment-blocking. The PR is blocked. The diverging entries are listed with prior/new output diff. No bypass mechanism exists.
**Detection:** CI replay regression against canonical corpus.

---

### CLASS_3: RECONSTRUCTION FAILURE
**Definition:** A corpus entry cannot be replayed to produce a verified output. Causes include: missing required input fields, unavailable rule_version, clock contamination, broken hash chain.
**Severity:** HIGH
**Action:** The corpus entry is marked INVALID and must not be presented as authoritative. Investigation required. The affected time window is reported to operators as UNAVAILABLE (not APPROXIMATE).
**Detection:** Corpus integrity scan; triggered on entry creation and nightly.

---

### CLASS_4: PARITY VIOLATION
**Definition:** The live and replay rendering of the same PRE resolution output differ in any field other than: state badge, live update feed, action affordances, temporal context header.
**Severity:** HIGH
**Action:** Deployment-blocking for the affected rendering module. Live and replay must use identical rendering components consuming the same PREOutput schema.
**Detection:** Frontend rendering parity tests comparing live vs replay render of identical PREOutput.

---

### CLASS_5: APPROXIMATION UNDISCLOSED
**Definition:** A replay surface presents an approximated or log-reconstructed result without a visible confidence label (EXACT / HIGH / MEDIUM / LOW / UNAVAILABLE).
**Severity:** MEDIUM
**Action:** Blocks deployment of the replay surface. Approximations are permitted only with explicit disclosure. Undisclosed approximations are invalid as operational evidence.
**Detection:** Replay surface renders any output from a non-exact corpus match without a confidence label.

---

## 7. REPLAY AS EVIDENCE — CONSTRAINTS

1. Only CLASS_1-free, CLASS_2-free, exact reconstructions (confidence = EXACT) carry evidentiary weight for sponsor compliance verification and formal incident investigation.
2. HIGH-confidence approximations are informational only.
3. MEDIUM and LOW approximations must be accompanied by explicit uncertainty disclosure and may not be cited in formal records.
4. UNAVAILABLE periods must be disclosed as gaps, not as "nothing happened."
5. Counterfactual output (simulations branching from historical state) is never historical record and must never be stored in the corpus as such.
