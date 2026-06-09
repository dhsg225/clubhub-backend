# TYPOGRAPHY AND INFORMATION LEGIBILITY v1

**Era:** Perceptual Governance
**Status:** CANONICAL
**Scope:** Hierarchy stability, operational scanability, dense-data readability, alert legibility, multi-device constraints, degraded conditions

---

## 1. PURPOSE

Typography on an operational surface is not type design. It is the mechanism by which operators extract operational meaning under time pressure, fatigue, distance constraints, and degraded conditions.

Every typographic decision — scale, weight, contrast, line spacing, truncation behavior — has an operational consequence. Typography that fails under fatigue is an operational failure. Typography that fails at distance is a deployment failure for venue floor and fleet-wall contexts.

**Operators must be able to read critical operational information correctly on the first attempt, under the worst expected conditions.**

---

## 2. HIERARCHY STABILITY

### 2.1 The Stability Requirement

Typographic hierarchy is fixed. The relative visual weight of operational information types does not change based on content, context, or proximity to other elements.

An operator who learns that "large, high-contrast text = immediate attention required" must be able to rely on that mapping permanently. If hierarchy shifts — if a content label sometimes appears at the same weight as an alert — operators lose calibration.

### 2.2 Canonical Hierarchy Levels

| Level | Token | Operational Role | When Used |
|---|---|---|---|
| **L1 — Critical** | `type.scale.critical` | Information requiring immediate operator recognition | TERMINAL/CRITICAL incident announcements, unrecoverable error states |
| **L2 — Alert** | `type.scale.alert` | Information requiring prompt operator attention | Incident declarations, authority warnings, stale resolution notices |
| **L3 — Operational** | `type.scale.operational` | Primary operational information, read during normal workflow | Schedule item titles, current venue name, active operator identity |
| **L4 — Reference** | `type.scale.reference` | Supporting information consulted during operator decisions | Schedule item details, resolution timestamps, PRE attribution |
| **L5 — Ambient** | `type.scale.ambient` | Background context, not requiring active reading | Corpus sequence numbers, system version, connection latency metric |

**Law:** No content at L4 or L5 may be styled at L1 or L2 weight, regardless of context. Hierarchy levels are determined by information class, not by visual interest.

**Law:** L1 and L2 sizes are never used for non-alerting content. Using large, bold type for schedule section headers is a hierarchy violation — it trains operators to ignore the L1/L2 visual signal.

### 2.3 Hierarchy Resistance to Density Pressure

As the visible surface fills with information (dense schedule, multiple active incidents, degraded-mode overlays), the pressure to reduce all text to a single small size increases. This is constitutionally forbidden.

**L1 and L2 levels do not shrink to accommodate density.** If the surface is too dense to display L1 content at its required size, other content is reduced or hidden — not the alert.

---

## 3. OPERATIONAL SCANABILITY

Operators scan before they read. An operator arriving at the control surface must be able to determine the system state within 2 seconds of looking — before reading any text in detail.

### 3.1 Scanability Requirements

**2-second scanability test:** An operator unfamiliar with the current state of the system must be able to correctly identify:
- Whether the system is in a nominal, degraded, or incident state
- Whether the current content view is LIVE or REPLAY
- Whether their operator session is active and at what authority level

...within 2 seconds of looking at the operational surface, without reading any text beyond L1/L2 items.

This is tested in the simulation harness using the operator cognition verification standards.

### 3.2 Scanability Design Rules

**Alignment consistency:** Elements of the same hierarchy level align consistently across the surface. An operator's eye learns where to look for L2 information. Inconsistent alignment breaks this reflex.

**Weight alone signals priority:** Operators under stress read weight before color and color before position. Weight must be the primary hierarchy signal, not position.

**No decorative weight variation:** Bold type communicates importance. Semi-bold type within body copy for visual rhythm is a consumer UI pattern. On an operational surface, it confuses hierarchy.

**No italic for operational information:** Italic is used only for explicit temporal differentiation — indicating that a value is historical or provisional. It is never used for visual style.

### 3.3 The Label-Value Pattern

All operational data is presented in explicit label-value pairs. Labels identify the data category. Values carry the data.

```
VENUE:          Staples Center Arena - Court Level
RESOLUTION:     Authoritative (12s ago)
MODE:           LIVE
```

Labels use L5 or L4 scale. Values use L3 or L2 scale depending on operational urgency. The label-value pattern provides scanability anchors — operators know where to look for each information type.

**Forbidden:** Data presented without labels (bare values with no context). An operator who sees "12s" cannot know if this is a latency figure, a resolution age, or a countdown.

---

## 4. DENSE-DATA READABILITY

The schedule view and historical replay view are inherently dense — many items, many timestamps, many states. Dense data requires specific typographic treatment that does not sacrifice hierarchy legibility.

### 4.1 Dense View Constraints

- Minimum body text size in dense views: `type.scale.reference` (L4) — never below this
- Line spacing in dense views: minimum 1.4× type size — never tighter
- Item separation: visual separation between items (border, background alternation, or spacing) must remain visible at minimum density. Items must never visually merge.
- Truncation: text that cannot fully display is truncated with `…` — it is never hidden, clipped without indicator, or wrapped unpredictably

### 4.2 Truncation Governance

When text must truncate:
- Truncation is always indicated with `…`
- The first 70% of the string is preserved (title, beginning of value) — the end is truncated
- Exception: timestamps are never truncated. If there is insufficient space, the surrounding element grows or the timestamp takes precedence over adjacent text.
- Truncated operational values (venue name, schedule item title) expose full content on operator focus/expand action

### 4.3 Numerical Readability

Numbers carry operational meaning (durations, counts, percentages, timestamps). Numerical formatting rules:

- Monospace font for all numerical values — alignment across rows is an operational necessity
- Timestamps always include timezone context or explicit UTC designation
- Duration values use explicit units (seconds, minutes) — never bare numerals for durations
- Percentages carry the `%` symbol, always
- Counts carry commas for readability above 999
- Negative values and decreases use an explicit sign (`−`) — not color alone

---

## 5. TEMPORAL READABILITY

Time is central to ClubHub TV operations. Temporal information must be unambiguous under all reading conditions.

### 5.1 Timestamp Format Requirements

All operational timestamps use: `YYYY-MM-DD HH:MM:SS TZ`

Abbreviated formats are permitted only for timestamps in the schedule view where context is established:
- `HH:MM:SS` (when date is visible in context header)
- `HH:MM` (for schedule items, where second precision is not needed)

**Forbidden:**
- Relative times (`2 minutes ago`) for authoritative operational data — relative times are ambiguous under unclear reference points
- AM/PM format — 24-hour time is required for operational clarity across operator cultures
- Timezone abbreviations without offset (EST is ambiguous; −05:00 is not)
- Date formats with ambiguous day/month order (`05/06/2026` is operationally dangerous)

### 5.2 Temporal Hierarchy in Schedule View

In the schedule view:
- Upcoming items (next to execute): L3 typography, full timestamp
- Currently executing item: L2 typography, elapsed and remaining time visible
- Past items: L4 typography, visually diminished (not hidden)
- Items beyond current corpus window (if in replay): L5 typography with explicit "outside corpus window" indicator

### 5.3 Countdown Legibility

When a schedule item countdown is displayed:
- Font is monospace (numerical position stability — no layout shift as digits change)
- The countdown value never uses leading zeros inconsistently (always `04:32`, never `4:32`)
- The unit is labeled explicitly when the scale changes (`04:32 remaining` → `32 seconds remaining`)

---

## 6. ALERT READABILITY

Alert typography must remain legible under the conditions in which alerts appear: operator stress, divided attention, ambient noise environments, and potentially degraded display conditions.

### 6.1 Alert Text Requirements

- Alert text uses L1 or L2 scale, never smaller
- Alert text uses maximum contrast against its background
- Alert text is never reversed from a medium-contrast background (white on orange is insufficient; white on near-black or black on high-visibility yellow)
- Alert text line length: maximum 80 characters per line — alerts are not paragraphs
- Alert text never wraps in a way that splits a critical phrase across lines (system may truncate if necessary, expanding on operator interaction)

### 6.2 Alert Message Construction

Operational alerts must be written to be understood in one reading pass:
- State what happened (not what might happen)
- State what is affected (specific, not general)
- State what operator action is available (explicit, not implied)

**Forbidden alert message:** "A problem may have occurred with some content."
**Required form:** "PRE resolution failed — Venue: Court Level — Last resolved 4m ago — Action: Force re-sync or apply fallback content"

Alert message construction is an operational writing standard, not a typography standard. But typography that makes alert messages harder to parse at a glance amplifies this problem.

### 6.3 Incident Severity Level Typography

Each incident severity level has a typographic treatment that communicates escalation:

| Level | Scale | Weight | Treatment |
|---|---|---|---|
| WATCHING | L4 | Regular | Subtle indicator |
| DECLARED | L3 | Medium | Visible banner |
| CONTAINED | L2 | Semibold | Prominent banner |
| RESOLVING | L2 | Semibold | Prominent banner with action label |
| CRITICAL | L1 | Bold | Full-width header presence |
| TERMINAL | L1 | Bold | Full-width, high-contrast, no competing elements |

---

## 7. MINIMUM COMPREHENSION STANDARDS

### 7.1 The First-Attempt Standard

Operators must be able to correctly comprehend any L1 or L2 typographic element on the first reading attempt, under the following degraded conditions:

- Operator fatigued (end of shift simulation)
- Ambient light: bright arena lighting (1000+ lux)
- Viewing distance: up to 3 meters from screen
- Reduced attention: operator is managing a concurrent conversation

These conditions are the baseline, not the exceptional case. Typography that only works under ideal conditions is not constitutionally compliant.

### 7.2 Failure Cases That Are Not Acceptable

- Alert text that requires multiple readings to parse
- Status labels where the word and its background have similar luminance
- Timestamps where the format is ambiguous without context
- Truncated text that obscures the semantically critical part of the value
- Any L1 or L2 text below 24px effective rendering size at 1× pixel density

---

## 8. ZOOM AND FLEET-WALL CONSTRAINTS

ClubHub TV operates on screens that range from individual operator terminals to venue fleet-wall displays visible from 10+ meters.

### 8.1 Fleet-Wall Legibility Requirements

For any surface intended for fleet-wall or group-visibility use:
- L1 scale minimum: 48px effective size
- L2 scale minimum: 32px effective size
- No information conveyed by text alone below L2 on fleet surfaces — must be paired with color or icon signal
- Timestamp precision on fleet surfaces: HH:MM only (seconds not legible at distance)

### 8.2 Zoom Independence

All typographic hierarchy is expressed in relative units, not absolute pixels. The hierarchy relationships (L1 > L2 > L3 > L4 > L5) remain correct at all zoom levels.

**Forbidden:** Typography that breaks hierarchy at system zoom levels above 150%. An L3 element must not become larger than an L2 element at any supported zoom level.

### 8.3 Multi-Screen Consistency

Typography rendering is verified across the target device range (Pi displays, operator tablets, fleet wall controllers). A hierarchy that appears correct on one screen class but breaks on another is a deployment failure.

---

## 9. DEGRADED READABILITY CONDITIONS

### 9.1 Display Hardware Degradation

When the rendering device reports display degradation (reduced backlight, gamma drift, partial pixel failure):
- The system does not attempt to compensate by increasing text complexity
- The system emits a display health warning in the shell chrome
- L1 and L2 text increase contrast to the maximum available range

### 9.2 Content Pane Degradation

When the content pane is in DEGRADED state:
- Stale data labels use L5 or L4 scale — they are context, not primary information
- Stale age indicators use L4 scale — secondary awareness
- The stale marker itself uses L2 or L3 scale — because the operator needs to know the data is stale before reading the data

### 9.3 Replay Mode Typography

During replay:
- The corpus packet timestamp is displayed at L3 scale in the pane header — not ambient, not buried
- The "REPLAY" mode label uses L2 scale in the shell chrome badge
- Historical schedule items use L4 scale with explicit historical treatment (muted weight variant)

---

## 10. FORBIDDEN TYPOGRAPHIC PATTERNS

| Pattern | Operational Failure |
|---|---|
| Italic text for schedule item titles or operational labels | Implies provisionality; operators may doubt the authority of the information |
| Uppercase-only text for L3 or below | Reduces reading speed by 15–20%; acceptable only for L1 critical alerts where shock value aids recognition |
| Text over image/video backgrounds without contrast protection | Legibility is environmental-light-dependent; operational text cannot be |
| Animated text (fade in, scroll, typewriter) | Animation delays reading; operational text must be immediately readable |
| Right-aligned numerical values without monospace font | Numerical comparison across rows requires column alignment |
| Dynamic font sizing based on content length | Creates unpredictable hierarchy; a long alert becomes small, defeating the alert |
| Color as the sole differentiator between text hierarchy levels | Fails for operators with color vision deficiency; weight must do primary hierarchy work |
| All-caps for body copy or dense views | Cognitive load increases dramatically; reserved for brief L1 labels only |
| Hairline weight for any operational data value | Fails at distance, under glare, and on lower-resolution fleet displays |
| Text shadows on operational information for "depth" | Reduces effective contrast; all shadow effects are decorative and forbidden |

---

*Document status: CANONICAL — Perceptual Governance Era*
*Do not modify without constitutional governance review*
