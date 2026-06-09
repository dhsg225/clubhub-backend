# DESIGN TOKEN CONSTITUTION v1

**Era:** Perceptual Governance
**Status:** CANONICAL
**Scope:** Token governance, immutable semantics, adaptation zones, replay safety, auditability, change approval

---

## 1. PURPOSE

Design tokens are the implementation boundary between constitutional visual semantics and rendered output. They translate the perceptual laws defined in `OPERATIONAL-VISUAL-SEMANTICS-v1.md`, `MOTION-AND-TRANSITION-GOVERNANCE-v1.md`, and `TYPOGRAPHY-AND-INFORMATION-LEGIBILITY-v1.md` into values that the frontend can consume and that the CI system can audit.

Tokens are not design preferences. Tokens encode operational safety constraints. A token change is a change to operational behavior. It follows the same governance process as a backend state machine change.

---

## 2. TOKEN ARCHITECTURE

### 2.1 Three-Layer Model

Tokens are organized in three layers. Each layer has a different change governance requirement.

```
Layer 1: Primitive Values
  Raw values — HSL color definitions, millisecond durations, pixel scales
  These are not used directly in components.
  Change governance: Architectural review required.

Layer 2: Semantic Tokens
  Named operational meanings — color.status.critical, type.scale.alert, motion.duration.fast
  These are what components consume.
  Change governance: Constitutional governance review required (highest standard).

Layer 3: Context Tokens
  Surface-specific bindings — shell.status-bar.background, pane.replay.border-color
  These bind semantic tokens to specific surfaces.
  Change governance: Architectural review required. Must not deviate from semantic layer constraints.
```

**Law:** Components consume only Layer 2 (semantic) or Layer 3 (context) tokens. Layer 1 primitive values are never consumed directly by components.

**Law:** Layer 3 context tokens may only reference Layer 2 semantic tokens — never Layer 1 primitive values directly. This ensures semantic meaning is always the intermediary.

### 2.2 Token Naming Convention

```
{layer}.{category}.{role}[.{variant}]

Examples:
  color.status.critical           — semantic: the critical severity color
  color.status.critical.background — semantic variant: background use of critical
  color.mode.replay               — semantic: the replay mode color
  type.scale.alert                — semantic: alert-level text scale
  motion.duration.fast            — semantic: fast transition duration
  shell.status-bar.background     — context: shell status bar background surface

Forbidden token names:
  primary-blue                    — not semantic
  big-text                        — not semantic
  orange                          — names a color, not a meaning
  urgent                          — ambiguous severity
  color.brand.accent              — brand tokens must not exist in the operational token set
```

---

## 3. IMMUTABLE SEMANTIC TOKEN CATEGORIES

The following token categories are constitutionally immutable in their operational meaning. Their values (colors, durations, scales) may be updated through the governance process, but their semantic role CANNOT be reassigned or repurposed.

### 3.1 Severity Color Tokens

```
color.status.nominal
color.status.advisory
color.status.warning
color.status.alert
color.status.critical
color.status.terminal
```

**Immutability rule:** These tokens always represent their named severity level. `color.status.critical` is never used for a non-critical condition. The tokens cannot be renamed to different severity concepts.

### 3.2 Operational Mode Color Tokens

```
color.mode.live
color.mode.replay
color.mode.degraded
color.mode.stale
color.mode.simulated
```

**Immutability rule:** These tokens always represent their named operational mode. `color.mode.replay` never applies to live content. Mode tokens cannot be repurposed for authority or severity signaling.

### 3.3 Content Classification Tokens

```
color.content.operational
color.content.schedule
color.content.sponsored
color.content.fallback
```

**Immutability rule:** `color.content.sponsored` never overlaps with `color.content.operational` or `color.content.schedule` in any rendering context.

### 3.4 Typography Scale Tokens

```
type.scale.critical      — L1
type.scale.alert         — L2
type.scale.operational   — L3
type.scale.reference     — L4
type.scale.ambient       — L5
```

**Immutability rule:** Scale ordering (L1 > L2 > L3 > L4 > L5) is permanent. No token reassignment may invert this order.

### 3.5 Motion Duration Tokens

```
motion.duration.immediate    — 0ms
motion.duration.fast         — 100ms–150ms
motion.duration.standard     — 200ms–300ms
motion.duration.relaxed      — 400ms–500ms
```

**Immutability rule:** The ordering (immediate < fast < standard < relaxed) is permanent. `motion.duration.fast` must always be shorter than `motion.duration.standard`.

### 3.6 Motion Easing Tokens

```
motion.easing.state-transition    — decelerate-out
motion.easing.active-process      — linear
motion.easing.temporal-position   — operator-proportional
```

**Immutability rule:** Easing tokens encode operational meaning (see MOTION-AND-TRANSITION-GOVERNANCE-v1.md Section 3). Their operational category cannot change.

---

## 4. ALLOWABLE ADAPTATION ZONES

These token categories may be adapted within documented constraints, without requiring constitutional governance review.

### 4.1 Shell Surface Tokens (Context Layer)

Shell surface tokens may have their primitive values adjusted for display hardware calibration (brightness, gamma) provided:
- Contrast ratios between all severity levels remain above the constitutional minimum (4.5:1 standard text; 3:1 large text)
- LIVE and REPLAY mode tokens remain perceptually distinct at ≥7:1 contrast ratio between them under expected venue lighting conditions
- Changes are made through the token governance process (not directly in code)

### 4.2 Density Variant Tokens

Compact/expanded layout variants may define density-specific context tokens:

```
shell.status-bar.compact.font-size
shell.status-bar.expanded.font-size
```

These may differ in scale, provided both variants meet the minimum scale requirements for their content category (L1 content never below constitutional minimum regardless of density variant).

### 4.3 Display Calibration Tokens

Per-deployment display calibration adjustments (venue-specific hardware profiles) are permitted in a dedicated calibration layer:

```
calibration.brightness-offset
calibration.contrast-multiplier
```

These are applied as post-processing adjustments and must not alter the semantic relationships between tokens. If a brightness offset would cause two severity levels to become indistinguishable, the offset is rejected.

---

## 5. REPLAY-SAFE TOKEN EVOLUTION

Tokens are part of the operational truth surface. Token changes affect what operators see. Token history must be auditable.

### 5.1 Token Versioning Requirement

Every token in the semantic layer carries a version and change history:

```json
{
  "color.status.critical": {
    "value": "hsl(0, 85%, 45%)",
    "version": 3,
    "introduced": "2026-05-26",
    "history": [
      { "version": 1, "value": "hsl(0, 90%, 50%)", "introduced": "2026-01-01", "retired": "2026-03-15" },
      { "version": 2, "value": "hsl(0, 88%, 47%)", "introduced": "2026-03-15", "retired": "2026-05-26" },
      { "version": 3, "value": "hsl(0, 85%, 45%)", "introduced": "2026-05-26", "retired": null }
    ],
    "semanticRole": "CRITICAL_SEVERITY",
    "immutable": true
  }
}
```

### 5.2 Replay Token Consistency

When replaying historical corpus content, the rendering system uses the token values that were active at the time of the corpus packet's `packetTimestamp`. This ensures historical replay renders as it appeared when it was live.

Token history enables this: given a corpus packet timestamp, the system can determine which token version was active and apply it during replay.

**Law:** Token history is never deleted. Retired token values are retained indefinitely to support replay consistency.

### 5.3 Token Value Retrieval for Replay

```typescript
function getTokenValueAtTime(
  tokenName: string,
  timestamp: string  // ISO8601 — the corpus packet timestamp
): string {
  const token = tokenRegistry[tokenName];
  const activeVersion = token.history.find(v =>
    v.introduced <= timestamp &&
    (v.retired === null || v.retired > timestamp)
  );
  return activeVersion?.value ?? token.value;
}
```

This function is tested against all retained corpus packets whenever token history is modified.

---

## 6. TOKEN AUDITABILITY

### 6.1 Token Audit Log

Every token change produces an audit log entry:

```typescript
interface TokenChangeAuditEntry {
  tokenName: string;
  previousValue: string;
  newValue: string;
  changedAt: string;         // ISO8601
  changedBy: string;         // engineer identifier
  approvedBy: string[];      // governance reviewers
  changeReason: string;
  impactAssessment: {
    affectedSurfaces: string[];
    severityLevelImpact: boolean;
    replayConsistencyVerified: boolean;
    contrastRatioVerified: boolean;
    venueDisplayTestingRequired: boolean;
  };
}
```

### 6.2 CI Token Audit Gate

The CI pipeline runs a token audit check on every frontend build:

```bash
pnpm run audit:tokens

# Checks:
# 1. All semantic tokens have version and history entries
# 2. No component consumes Layer 1 primitive values directly
# 3. No context token references a Layer 1 primitive directly
# 4. Severity token ordering is preserved (nominal < advisory < ... < terminal perceptually)
# 5. LIVE and REPLAY tokens maintain minimum contrast distance
# 6. No immutable token's semantic role has changed
# 7. Token history is not missing entries (no gaps in version timeline)
# 8. Replay corpus test: token values at historical timestamps produce expected rendering
```

All checks are deployment-blocking.

### 6.3 Token Surface Coverage Report

On each build, the token audit generates a surface coverage report: which tokens are consumed by which surfaces. This report is attached to the certification evidence package (see DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1.md Section 5).

Any semantic token with zero surface coverage is flagged as a candidate for deprecation review.

---

## 7. ANTI-THEME-FRAGMENTATION RULES

The operational token system does not support themes. There is one operational token set. The following requests are refused:

### 7.1 Forbidden Theme Requests

**"Dark mode":** The operational system may support a lower-luminance display profile for venue environments. This is a display calibration adjustment (Section 4.3), not a theme. It applies brightness and gamma adjustments. It does not reassign semantic token meanings. It does not create an alternative token set.

**"Venue brand theme":** Venue operators may apply sponsor content within sponsor content zones. They may not apply a venue-branded theme to operational surfaces. The operational surface is the operator's tool, not a venue's marketing surface.

**"White-label operator theme":** Operators deploying ClubHub TV as a white-label product may customize the logo and name in the shell chrome. They may not customize the operational token semantics. An operator learning to read the system in one deployment must be able to read it correctly in any other deployment.

**"Night mode" with reduced contrast:** Reducing contrast for "eye comfort" at night reduces the legibility of severity signals. This is an operational safety failure. Display brightness may be reduced via hardware or calibration layer. Token contrast relationships do not change.

### 7.2 The Single-Set Rule

There is one canonical semantic token set. Implementations consume it. If a new display context (new screen hardware, new venue type) creates requirements that the current token set cannot meet, the constitutional governance process handles this — the response is never to fork a parallel token set.

### 7.3 Detecting Fragmentation

The CI token audit detects token fragmentation:
- Multiple definitions of the same semantic token name
- Context tokens that reference undefined semantic tokens
- Components that define inline color or typography values instead of consuming tokens

Any detected fragmentation is a deployment-blocking failure.

---

## 8. ACCESSIBILITY AS OPERATIONAL INTEGRITY

Accessibility requirements on operational surfaces are not compliance obligations — they are operational integrity requirements. An operator who cannot reliably perceive the severity spectrum is an operator whose reflex training fails. The system owes every operator legible signals.

### 8.1 Contrast Requirements

| Token Category | Minimum Contrast Ratio | Standard |
|---|---|---|
| Severity text on background | 7:1 | WCAG AAA (severity signals demand maximum legibility) |
| Mode indicator text on background | 4.5:1 | WCAG AA |
| L1/L2 typography on background | 7:1 | WCAG AAA (alerts require maximum legibility) |
| L3 typography on background | 4.5:1 | WCAG AA |
| L4/L5 typography on background | 3:1 | WCAG AA Large |
| Severity status indicator (icon/badge) | 3:1 against adjacent surface | WCAG AA Non-text |

### 8.2 Color-Independence Requirement

No operational distinction is communicated by color alone. Every semantic color differentiation is paired with at least one of:
- A weight difference (bold vs regular)
- A shape or icon difference
- An explicit text label

This ensures that operators with color vision deficiency receive the full semantic signal.

**Test:** Convert any operational surface rendering to grayscale. Every operational distinction that was visible in color must remain visible in grayscale through weight, shape, or text alone.

### 8.3 Motion Sensitivity

Operators may have vestibular disorders or motion sensitivity. The operational surface must function completely without animation:

- All motion is additive — removing it does not remove any operational information
- Status changes, mode changes, and severity escalations are communicated by color and text, not by motion alone
- A "reduce motion" calibration setting suppresses all Category A–D animations while preserving full operational meaning

### 8.4 Accessibility Audit Gate

The CI pipeline includes an automated accessibility check:

```bash
pnpm run audit:accessibility

# Checks:
# 1. All contrast ratios meet constitutional minimums for their token category
# 2. No semantic distinction is carried by color alone (grayscale check)
# 3. All animations are suppressible without information loss
# 4. All interactive elements have accessible labels
# 5. Motion suppression mode does not degrade operational information
```

All accessibility checks are deployment-blocking.

---

## 9. CONSTITUTIONAL TOKEN CHANGE APPROVAL PROCESS

### 9.1 Change Categories

| Change Type | Approval Required | Review Time |
|---|---|---|
| Primitive value adjustment (brightness calibration) | Architectural review | Standard PR cycle |
| Context token binding change | Architectural review | Standard PR cycle |
| Semantic token value change (color, scale, duration) | Constitutional governance review | Extended review — minimum 5 business days |
| Semantic token meaning change | Constitutional governance review + perceptual safety audit | Extended review — minimum 10 business days |
| New semantic token introduction | Architectural review | Standard PR cycle |
| Semantic token deprecation | Constitutional governance review | Extended review — minimum 5 business days |
| Token history deletion or modification | Prohibited | Not permitted |

### 9.2 Constitutional Governance Review Requirements

For any change requiring constitutional governance review:

1. **Impact statement:** What surfaces are affected. Which operator workflows are affected.
2. **Before/after rendering:** Side-by-side visual comparison under nominal, degraded, and incident conditions.
3. **Contrast verification:** Automated contrast ratio check for all affected token pairs.
4. **Replay consistency verification:** Confirmation that historical corpus rendering at the previous token version remains accurate via the token version history system.
5. **Perceptual safety assessment:** Verification that the change does not reduce the perceptual distinction between any two severity levels, or between LIVE and REPLAY modes.
6. **Operator cognition review:** Confirmation that operator reflex training built on the previous token values is not invalidated (i.e., the semantic role has not changed, only the value).

### 9.3 Emergency Token Changes

In the event of a rendering defect that creates a safety-critical perceptual failure (e.g., two severity levels become indistinguishable due to a display hardware issue), an emergency token change may be deployed without the full review cycle. Requirements:

- Approved by any two governance reviewers
- Audit log entry required within 24 hours
- Full constitutional governance review required within 10 business days
- Token history must be updated retrospectively

Emergency changes that cannot meet these requirements are not emergency changes — they are unauthorized changes.

### 9.4 Token Freeze Policy

Token semantic changes are prohibited during:
- Active incident (severity DECLARED or above)
- Active deployment rollout window
- Corpus freeze periods

Changes staged during a freeze take effect after the freeze lifts. They do not apply retroactively.

---

## 10. TOKEN GOVERNANCE INVARIANTS

These invariants are unconditional:

**Invariant T-1:** Token history is never deleted.

**Invariant T-2:** Immutable semantic token categories never change their operational meaning, only their rendered value.

**Invariant T-3:** Components never consume Layer 1 primitive values.

**Invariant T-4:** LIVE and REPLAY mode tokens are always perceptually distinct.

**Invariant T-5:** The severity spectrum ordering (nominal → terminal) is always reflected in the perceptual ordering of severity tokens.

**Invariant T-6:** Accessibility contrast minimums are enforced in CI for every build.

**Invariant T-7:** The token set is singular. No parallel theme sets exist.

**Invariant T-8:** Replay rendering uses token values active at the corpus packet timestamp.

**Invariant T-9:** Token changes require audit log entries. No undocumented token changes reach production.

**Invariant T-10:** Sponsor or venue brand values never enter the semantic or context token layers.

---

*Document status: CANONICAL — Perceptual Governance Era*
*Do not modify without constitutional governance review*
