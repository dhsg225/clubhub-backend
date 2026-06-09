# ClubHub TV — Domain Language Glossary
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented operational memory
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS/Architecture), Agent 3 (UX/Design), Operators
**Last updated:** 2026-05-24

---

## Purpose

This document is the canonical terminology system for ClubHub TV. It serves three distinct functions:

1. **Shared engineering language** — prevents the "same concept, three names" failure mode where engineers and designers solve the same problem three different ways because they called it differently.
2. **Operator-system translation layer** — documents the gap between what operators call things and what the system calls them. This gap is a source of UX friction, training failure, and operational entropy.
3. **Constitutional anchor** — every term defined here is evaluated against the Engineering Constitution and PRE specification. Where a common operator term would imply system behavior that is unconstitutional, this is noted explicitly.

This glossary is append-oriented. Do not delete entries. Mark outdated terms as deprecated and explain why.

---

## Governing Philosophy

**Precision outranks familiarity.** When an operator uses a term that is imprecise or implies incorrect system behavior, the correct response is to surface the imprecision, not to adopt the term as canonical.

**Translation is not simplification.** Documenting what operators call things does not mean those terms are correct. It means we know what they mean, even when they are wrong.

**No synonyms in code.** If this document defines a canonical term, that term appears in code, API responses, database columns, and log messages. Synonyms belong in the UX layer and in training materials — not in the system itself.

---

## Glossary Structure

Each entry contains:
- **Canonical term** — the authoritative system name
- **Layer** — `system` (technical), `operator` (human-facing UX), `both` (aligned)
- **Definition** — precise meaning
- **Operator equivalent(s)** — how operators typically refer to this concept
- **Gap analysis** — where operator and system meanings diverge
- **Constitutional implications** — where relevant, connection to invariants or constitution clauses
- **Do not confuse with** — disambiguation from related terms

---

## Section 1 — Resolution and Playback

---

### PRE (Playback Resolution Engine)

**Layer:** system
**Definition:** The pure deterministic function `PRE(screen_id, t, SystemState) → PRE_Output` that computes the authoritative playlist for a given screen at a given time. The PRE has no side effects, reads no wall-clock time, and issues no network calls. It is the single source of truth for what should play on any screen at any moment.
**Operator equivalent:** "the system," "the algorithm," "what decides what plays," (no consistent operator term exists)
**Gap analysis:** Operators rarely conceptualize the PRE as distinct from the broader system. They tend to reason about "the schedule" or "the content" as deciding what plays, not a resolution engine. This gap causes the "I set it up, why isn't it playing?" confusion — because they edited the schedule (an input) not the resolution (the output).
**Constitutional implications:** INV-1 through INV-10 all govern PRE behavior. The PRE is the most constitutionally constrained component of the system.
**Do not confuse with:** manifest delivery (the network layer that serves PRE outputs to devices), scheduling (the operator act of defining inputs to the PRE)

---

### Resolution

**Layer:** both
**Definition (system):** The act of computing `PRE(screen_id, t, S)` to produce a PRE_Output — the specific, ordered, weighted playlist for a screen at a moment in time.
**Definition (operator):** Operators use "resolution" rarely. When they do, they usually mean "the result" rather than "the process." More commonly operators say "what's playing" or "what's scheduled."
**Gap analysis:** The operator concept of "what should play" is static in their mental model (they set it up, it should stay that way). The system concept of resolution is dynamic — it is recomputed at every poll. This gap is the single biggest source of operator confusion.
**Constitutional implications:** Resolution must be total (INV-2), deterministic (INV-3), and pure (INV-1).
**Do not confuse with:** playback (the physical act of a screen displaying content), scheduling (defining the inputs to resolution)

---

### Resolution Level

**Layer:** system
**Definition:** One of seven ordered evaluation stages in the PRE: LEVEL_0 (Emergency), LEVEL_1 (Operational Override), LEVEL_2 (Scheduled Override), LEVEL_3 (Campaign/Schedule), LEVEL_4 (Sponsorship Injection), LEVEL_5 (Structural Fallback), LEVEL_6 (Device Truth Annotation). The PRE evaluates levels in order and terminates at the first level that produces a complete playlist.
**Operator equivalent:** "priority," "rank," "which one wins," "what overrides what"
**Gap analysis:** Operators understand there is a priority hierarchy but do not know the exact levels. They commonly believe that a higher priority number means a higher priority level — which is true within a level (priority is a numeric tiebreaker at LEVEL_3) but false across levels (an override at LEVEL_1 beats any LEVEL_3 schedule regardless of priority numbers).
**Constitutional implications:** Level termination is governed by INV-5. Emergency absoluteness is INV-7. No level may produce side effects (INV-1).
**Do not confuse with:** priority (a numeric field on schedule rows that determines ordering within LEVEL_3 resolution), specificity (the targeting scope of a rule that determines ordering at the same level)

---

### Playlist

**Layer:** both
**Definition (system):** The ordered sequence of `PlaylistItem` objects produced by the PRE for a screen at a time. Each item has a `content_id`, `duration_ms`, `weight`, `source`, and `source_rule_id`. Playlist ordering is deterministic. Playlist identity is captured by the `playlist_checksum` (FNV-1a of canonical serialization).
**Definition (operator):** Operators use "playlist" to mean "a list of things to show." They often treat it as directly editable — "I want to change the playlist" — when what they mean is "I want to change the schedules that produce the playlist."
**Gap analysis:** Operators expect to edit a playlist directly, as in a music player. The system computes playlists from configuration. This gap is fundamental to operator training.
**Constitutional implications:** Playlist immutability after resolution is implicit in INV-3 (determinism) and INV-1 (purity).
**Do not confuse with:** schedule (the time-windowed rules that cause content to appear in a playlist), manifest (the versioned network payload that wraps the playlist)

---

### Manifest

**Layer:** system
**Definition:** The network payload delivered to a player device at each poll. Contains the current PRE_Output plus delivery metadata: `version`, `playlist_checksum`, `resolved_at`, `confidence_score`, `is_fallback`. The player uses the checksum to detect changes and avoid unnecessary re-rendering.
**Operator equivalent:** "the content," "the file," "what the screen gets" (operators rarely think at this layer)
**Gap analysis:** Operators don't distinguish manifest from playlist from content. This is fine — the manifest layer is infrastructure, not operator concern. However, when debugging ("the screen isn't updating"), understanding the manifest/version/poll cycle is essential.
**Do not confuse with:** playlist (the content sequence inside the manifest), content item (the media asset referenced by a playlist item)

---

### System Fallback

**Layer:** system (operator-facing label: "fallback content")
**Definition:** A compiled-in, static playlist (`system:fallback:v1`, 30,000ms duration) that the PRE returns when no schedulable content exists and no other resolution path terminates. Requires no database access. Always available. Represents LEVEL_5 resolution with `is_fallback: true`.
**Operator equivalent:** "the default slide," "the blank screen," "what shows when nothing is scheduled," "the fallback"
**Gap analysis:** Operators often don't know what fallback content looks like until they see it in production. When they do see it, they sometimes panic ("the screen is broken"), not recognizing it as intentional safe behavior.
**Constitutional implications:** INV-2 (totality) requires the system fallback to always be available. LEVEL_5 activation is the safety net for all empty-resolution scenarios.
**Do not confuse with:** emergency fallback (`system:emergency-fallback:v1` — used only during LEVEL_0 emergency resolution)

---

### Specificity

**Layer:** system
**Definition:** A measure of how narrowly a scheduling rule or override targets its subject. Six levels exist: screen-targeted (SPEC_5, most specific), tv_group-targeted (SPEC_4), area-targeted (SPEC_3), venue-targeted (SPEC_2), org-targeted (SPEC_1), global (SPEC_0, least specific). More specific rules take precedence within the same resolution level.
**Operator equivalent:** "which screen it applies to," "is it for all screens or just one?" (no operator concept of a numeric specificity scale)
**Gap analysis:** Operators understand that a rule "for screen A" overrides a rule "for all screens." They do not understand the full six-level hierarchy. They frequently confuse specificity with priority — adding a higher priority to an area schedule expecting it to override a per-screen override, which cannot happen because priority operates within a level, not across specificity levels at the same level.
**Do not confuse with:** priority (a numeric ordering field within LEVEL_3 campaign resolution), resolution level (the seven-stage evaluation hierarchy)

---

### Confidence Score

**Layer:** system (operator-facing in diagnostics surfaces only)
**Definition:** A real number in [0.0, 1.0] representing the PRE's certainty that a screen is currently displaying its expected playlist. Computed from: delivery log recency, checksum match, override/emergency state, and last-seen timing. Not an operator-configurable field.
**Operator equivalent:** "is it actually playing?", "is the screen up?", "is it showing the right thing?"
**Gap analysis:** Operators have an intuitive need for confidence information but no vocabulary for it. They experience confidence score issues as "the screen looks wrong" or "we're not sure what's showing." The confidence score answers this systematically.
**Constitutional implications:** INV-10 (output completeness) requires confidence_score to be present in every PRE output. Its computation is governed by INV-6 (no amplification) — it cannot invent content knowledge beyond what the delivery log provides.
**Do not confuse with:** is_fallback (a boolean; confidence score is a continuum), resolution level (the path the PRE took; confidence score is an annotation on the result)

---

### Reason Trace

**Layer:** system (operator-facing in preview and diagnostics)
**Definition:** A structured field in PRE_Output that records which rule (at which level and specificity) terminated or influenced resolution, and why non-winning paths were skipped. Makes PRE resolution fully explainable — every output can be traced back to its cause.
**Operator equivalent:** "why is that showing?", "what made it do that?", "can I see the explanation?"
**Gap analysis:** Operators want explanations in natural language. The reason_trace is structured JSON. UX design must translate reason_trace fields into human language without losing constitutional precision.
**Constitutional implications:** INV-5 (level termination) requires reason_trace to record the terminating level and null out skipped higher levels. INV-2.2 of the Engineering Constitution states "Explainability outranks optimization."
**Do not confuse with:** audit log (the external record of state mutations; reason_trace is an output annotation, not a mutation record)

---

## Section 2 — Content Configuration

---

### Schedule

**Layer:** both
**Definition (system):** A database row in the `schedules` table with: target scope (screen/group/area/venue/org/global), time window (starts_at, ends_at), day-of-week constraint, time-of-day window, content references, priority, and campaign_id. The PRE reads schedules as inputs. Schedules are created either by the Scheduling Service (from campaigns) or directly (operational direct-schedule creation).
**Definition (operator):** "A piece of content I've set up to show during certain times." Operators often use "schedule" to mean the entire content management act, not just the rows.
**Gap analysis:** Operators conflate the schedule row with the campaign that generates it. They may create a schedule directly without a campaign, not understanding that this bypasses the campaign governance model. The `campaign_id IS NULL` entropy metric (M-03) captures this drift.
**Do not confuse with:** campaign (the parent intent record that materializes into schedule rows), override (a time-bounded or priority-forced content replacement at a higher resolution level)

---

### Campaign

**Layer:** both
**Definition (system):** A parent record in the `campaigns` table with `draft/published/archived` lifecycle. A published campaign materializes schedule rows in the `schedules` table. Rollback restores from `rollback_snapshot`. Staged publish can materialize for a subset of areas.
**Definition (operator):** "A marketing initiative," "a promotion we're running," "the October campaign." Operators think of campaigns as top-level marketing programs, not as schedule generators.
**Gap analysis:** Operators understand campaigns at the business level but not at the technical level. They don't know that publishing a campaign creates schedule rows, or that modifying a schedule row created by a campaign doesn't modify the campaign. This creates the "I published the campaign, but something changed and now they're out of sync" failure mode.
**Do not confuse with:** schedule (the materialized rows a campaign creates), promotion (a marketing term operators may use for any time-bounded content, whether campaign-managed or not)

---

### Override

**Layer:** both
**Definition (system):** A record in the `overrides` table with target scope, content references, timestamps, status, and optional expiry. Overrides resolve at LEVEL_1 (operational) or LEVEL_2 (scheduled), above campaign scheduling. A per-screen override at LEVEL_1 is the highest-specificity non-emergency control available to an operator.
**Definition (operator):** "Forcing content," "locking a screen," "making this screen show X regardless of everything else," "a one-off," "a temporary fix"
**Gap analysis (critical):** Operators treat overrides as temporary fixes. The system has no mechanism to enforce temporariness — `expires_at` is optional. This is the root cause of the Override Divergence entropy pattern (M-01): "temporary" overrides accumulate into permanent state.
**Gap analysis (secondary):** Operators don't know that an override at LEVEL_1 is invisible to anyone looking only at the campaign schedules. A manager publishing a venue-wide campaign update may not know 20% of screens are under override and will not receive it.
**Constitutional implications:** Override accumulation is tracked by M-01 (Override Divergence Rate) and M-02 (Override Age Distribution). The system must not auto-clear overrides (principle 2.3 of Engineering Constitution: Visibility outranks automation).
**Do not confuse with:** emergency (LEVEL_0 — absolute system control, no content selection, system-defined emergency content only), schedule (LEVEL_3 — the normal campaign-driven content path)

---

### Emergency

**Layer:** both
**Definition (system):** An `emergency_states` record that, when active, causes ALL screens in its target scope to resolve at LEVEL_0 with emergency content only. Emergency resolution is absolute — no other rule can override it. The emergency content is from the `emergency_states.content_id` field. Deactivation is explicit operator action.
**Definition (operator):** "Taking over all screens immediately," "lockdown," "broadcast mode," "the big red button," and (dangerously) "the fastest way to show something everywhere immediately"
**Gap analysis (critical):** Operators discover that emergency activation is the fastest, most reliable way to ensure content appears on all screens immediately. Under time pressure, they use it for operational purposes (sports night, promotional push, urgent message) rather than genuine safety/emergency purposes. This is Emergency Semantic Collapse (M-06/M-12).
**Gap analysis (secondary):** Operators do not reliably understand that emergency content is predetermined, not selectable at activation time. Some expect to choose what plays during an emergency.
**Constitutional implications:** INV-7 (Emergency Absoluteness) — CATASTROPHIC severity if violated. Emergency resolution is the highest constitutional invariant after purity. Misuse does not violate the invariant (the PRE still resolves correctly) but destroys the audit trail value.
**Do not confuse with:** override (operator-selected content at LEVEL_1/2; emergency is system-defined content at LEVEL_0)

---

### Content Item

**Layer:** both
**Definition (system):** A record in the `content_items` table referencing a media asset. Has an ID, type, duration_ms, and asset reference. Content items are referenced by schedule rows, override records, and campaign content specifications.
**Definition (operator):** "A slide," "a video," "an image," "a piece of content," "media"
**Gap analysis:** Minimal — operators' intuition here is correct. The friction point is duration: operators set duration at the content item level but often expect duration to be overridable at the schedule level (it isn't in the current model).
**Do not confuse with:** playlist item (a PlaylistItem in the PRE output, which wraps a content_item reference with weight and source metadata)

---

### Sponsorship Contract

**Layer:** both
**Definition (system):** A record in `sponsorship_contracts` with contracted share-of-voice (SOV) percentage, venue scope, time window, and content_item references. The PRE injects sponsor content at LEVEL_4 (Sponsorship Injection) additively — it modifies the base playlist without replacing it.
**Definition (operator):** "A sponsor deal," "the sponsor slot," "sponsor content," "the sponsor percentage"
**Gap analysis:** Operators understand SOV conceptually but not mechanically. They often expect sponsor content to appear at a fixed frequency (e.g., "every 5th slide") rather than as a weighted injection determined by the SWRR algorithm. They may not understand that two sponsors with 15% each produce 30% total sponsor content, not 15%.
**Do not confuse with:** schedule (sponsor content appearing through a schedule, not a contract, is not constitutionally injected at LEVEL_4 and therefore not subject to SOV tracking)

---

### Priority

**Layer:** both
**Definition (system):** A numeric integer field on schedule rows. Used as a tiebreaker when multiple schedules at the same specificity level are both active for the same screen at the same time. Higher priority wins. Priority is only meaningful within LEVEL_3 resolution and within the same specificity tier. A LEVEL_3 area schedule at priority 1000 loses to a LEVEL_1 override at priority 1.
**Definition (operator):** "How important the content is," "which one wins," "the rank order." Critically: operators conflate priority with resolution level and specificity. They expect that a higher priority number guarantees content plays more frequently.
**Gap analysis (critical):** The most common source of operator configuration error. Operators escalate priority numbers (Pattern D, Priority Escalation) expecting this to change resolution behavior, when in fact it only matters when two schedules are competing at the same level and specificity. A LEVEL_3 per-area schedule at priority 500 will always lose to a LEVEL_1 per-screen override at priority 1.
**Do not confuse with:** resolution level (the seven-stage hierarchy), specificity (the targeting scope hierarchy), weight (the SWRR weighting that determines interleaving frequency within a resolved playlist)

---

### Weight

**Layer:** system
**Definition:** A numeric field on `PlaylistItem` (PRE output) and optionally on content mix entries. Used by the SWRR algorithm to determine the relative frequency of items in an interleaved playlist. A content item with weight 2 appears approximately twice as often as one with weight 1. Weight is normalized by GCD before SWRR computation.
**Operator equivalent:** "How often it plays," "frequency," "how much screen time it gets"
**Gap analysis:** Operators intuitively understand frequency but don't know the mechanism. They expect that "adding more copies" increases frequency — which is true but also creates Shadow Scheduling entropy (M-07). The correct mechanism is adjusting weight, not duplicating rows.
**Do not confuse with:** priority (ordering within LEVEL_3; weight is frequency within a resolved playlist), SOV (sponsor share-of-voice, which is a contract-level weight distinct from playlist item weight)

---

## Section 3 — Targeting and Scope

---

### Screen

**Layer:** both
**Definition (system):** A record in the `screens` table. The atomic unit of content delivery. Each physical display device has exactly one screen record. A screen belongs to one tv_group, one area, one venue, one organization.
**Definition (operator):** "A TV," "a monitor," "a display," "a screen," "that TV in the lounge"
**Gap analysis:** Operators often refer to screens by their physical location, not their system ID. The location vocabulary is crucial for UX: "the bar screen" must be mappable to a screen_id for operators to work effectively.
**Do not confuse with:** tv_group (a logical grouping of screens that share content), device (the physical Pi appliance; one device drives one screen)

---

### TV Group

**Layer:** system (operator-facing label: "group" or "display zone")
**Definition (system):** A record in `tv_groups`. A logical grouping of screens within an area that receive the same content as a unit. Exists between the screen and area levels in the targeting hierarchy.
**Definition (operator):** "A zone," "screens in the same area," "the bar TVs," "the dining room displays"
**Gap analysis:** Operators naturally think in physical zones (bar, dining, lobby, sports zone). TV groups are the system mechanism for this intuition, but the vocabulary gap is significant — operators rarely use "tv_group" as a term, defaulting to spatial descriptions.
**Do not confuse with:** area (a larger grouping that contains tv_groups), screen (the individual unit within a tv_group)

---

### Area

**Layer:** both
**Definition (system):** A record in `areas`. A functional zone within a venue containing one or more tv_groups. Typically maps to a named room, floor, or operational zone. The most common targeting level for campaign scheduling — campaigns are usually published to areas.
**Definition (operator):** "A zone," "a section," "the bar area," "the gaming floor," "the main dining room," "the pool area"
**Gap analysis:** Operators understand areas intuitively as their own naming system for venue zones. The friction is that their naming is fluid ("the snug," "the function room," "the beer garden") while the system requires a formal area record with a stable ID.
**Do not confuse with:** venue (the physical venue containing areas), tv_group (a grouping within an area)

---

### Venue

**Layer:** both
**Definition (system):** A record in `venues`. The physical location record. Has one timezone (IANA format, mandatory), belongs to one organization. Contains areas. The PRE uses `venue.timezone` for all local time computation — no other timezone source is permitted (INV-9).
**Definition (operator):** "The club," "the site," "our venue," "this location" (for multi-venue operators: "the city club," "the northern branch")
**Gap analysis:** For multi-venue operators, venue identity is constantly in context ("are you looking at the right venue?"). For single-venue operators, "venue" is invisible — there is only one, so the distinction doesn't register.
**Constitutional implications:** INV-9 (Timezone Isolation) — venue.timezone MUST be a valid IANA timezone string. Abbreviations (AEST, CDT) are constitutionally forbidden in the system.
**Do not confuse with:** organization (the parent entity that may own multiple venues)

---

### Organization

**Layer:** system (operator-facing: "org," "the company," "head office")
**Definition (system):** The top-level entity in the targeting hierarchy. An organization owns one or more venues. Org-level targeting (SPEC_1) applies to all screens across all venues of the organization.
**Definition (operator):** "The company," "head office," "the group," "corporate"
**Gap analysis:** Org-level awareness is almost exclusively a management/enterprise concern. Venue-level operators typically don't know or care that org-level rules exist. This is a risk: org-level overrides or campaigns are invisible to venue operators unless specifically surfaced.
**Do not confuse with:** venue (the physical location record; org is the parent entity)

---

## Section 4 — System States and Events

---

### Active

**Layer:** both
**Definition (system):** For any schedulable rule (schedule, override, emergency, contract): the rule is active if its `status = 'active'` AND its temporal constraints are satisfied at the evaluation time `t`. A rule with `status = 'active'` but outside its time window is NOT active.
**Definition (operator):** "It's turned on," "it's running," "it's live"
**Gap analysis (critical):** Operators often believe "active" means "currently showing." An active schedule may be active but not winning resolution (a higher-level override is terminating first). An active campaign may be published and active but the screen is under override. "Active" is a status, not a display guarantee.
**Do not confuse with:** enabled (a simpler status toggle; in ClubHub context, always use "active/inactive" not "enabled/disabled"), live (a colloquial operator term; avoid in system vocabulary)

---

### Delivery Log

**Layer:** system (operator-facing: "proof of play," "play logs")
**Definition (system):** The `screen_delivery_log` table. Records each manifest version delivered to each screen, with checksums, timestamps, and resolution level. The PRE reads the most recent delivery log entry as one input for confidence_score computation (INV-6).
**Definition (operator):** "Play logs," "proof of play," "what actually played," "the record"
**Gap analysis:** Operators understand proof-of-play as a reporting concept. They may not know that the system uses delivery log data in real-time resolution (for confidence scoring). This matters when diagnosing "the system says it's playing but the screen looks wrong."
**Constitutional implications:** The delivery log is the authoritative record for INV-4 (Monotone Versioning) — version numbers only increment when the checksum changes, as detected via delivery log comparison.
**Do not confuse with:** audit log (the record of configuration mutations — who changed what when), proof-of-play report (a derived report from delivery log data, not the log itself)

---

### Poll

**Layer:** system (operator-facing: "sync," "update," "check-in")
**Definition (system):** The HTTP request a player device makes to the manifest endpoint every 15 seconds. The player sends its current `screen_id` and optionally its current `version` and `checksum`. If the server's resolution produces a different checksum, the full new manifest is returned. If checksums match, a short confirmation response is returned.
**Definition (operator):** "Does the screen update automatically?" / "How fast does it update?" / "Why hasn't it changed yet?"
**Gap analysis:** Operators expect real-time updates. The 15-second poll cycle is an architectural reality that must be communicated clearly in UX: "Changes take effect within 15 seconds." Operators who don't know this cycle will repeatedly make changes and wonder why the screen isn't immediately reflecting them.
**Do not confuse with:** push notification (the system does not push to screens; screens poll)

---

### Version

**Layer:** system (operator-facing: "content version," "update number")
**Definition (system):** A monotonically increasing integer on each screen's manifest. Incremented exactly when the PRE output checksum changes. Unchanged content produces the same checksum and does not increment version. Version is the mechanism for detecting when a player needs to re-render.
**Definition (operator):** Operators don't think in versions. They think in "has it updated yet?"
**Gap analysis:** Version numbers are useful for diagnostics ("the screen is still on version 47, the server is at 52 — five updates haven't reached it"). This vocabulary is useful for support staff and technicians, not for venue operators.
**Constitutional implications:** INV-4 (Monotone Versioning) — version MUST never decrease. INV-3 (Determinism) — same inputs produce same checksum, which produces same version.
**Do not confuse with:** campaign version (a separate concept for campaign rollback), content item version (not currently in the model)

---

## Section 5 — Operational Health and Entropy

---

### Operational Entropy

**Layer:** system
**Definition:** The divergence between what operators intended to configure and what the system is actually configured to do. Entropy is not a technical error — the system is resolving correctly at all times. Entropy is the accumulation of human decisions, each individually rational, that interact over time to produce a system state no single operator would have chosen.
**Operator equivalent:** "Things are a mess," "I don't know what's showing on all the screens anymore," "we need to do a content audit," "it's gotten complicated"
**Gap analysis:** Operators experience entropy as confusion, not as a measurable drift. The entropy metrics (M-01 through M-12) make invisible drift visible. The goal is to surface entropy signals before operators experience them as confusion.
**Constitutional implications:** The entropy system is advisory-only (Engineering Constitution §2.3, Visibility outranks automation). The system MUST NOT auto-correct entropy.
**Do not confuse with:** system error (entropy is correct behavior on drifted inputs; a system error is incorrect behavior on any inputs), configuration error (a single wrong setting; entropy is the accumulation of many settings none of which is individually wrong)

---

### Advisory

**Layer:** system (operator-facing: "notice," "attention needed," "yellow flag")
**Definition:** An entropy or health signal that is above a threshold warranting operator attention but is not a blocking condition. Advisory signals surface information; they do not prevent actions. Advisory signals respect operator agency — the operator decides whether to act.
**Operator equivalent:** "A warning," "a notice," "something to look at"
**Gap analysis:** Operators often don't distinguish advisory from blocking. UX must clearly communicate the non-blocking nature of advisory signals. If advisories feel like errors, operators will experience alert fatigue and dismiss them.
**Constitutional implications:** Engineering Constitution §2.7 (Human operators are authoritative over intent) — advisory signals inform, they do not override.
**Do not confuse with:** blocking (a constitutional enforcement that prevents a specific action), error (a system fault that must be corrected)

---

### Divergence

**Layer:** system
**Definition:** In the replay/verification context: the condition where the current PRE implementation produces a different output than the expected output for a given input. Classified into five divergence classes (0=cosmetic through 4=catastrophic). Classes 3 and 4 block deployment.
**Definition (operational context):** The condition where a screen's observed playback state (from the delivery log) differs from the PRE's expected output. The root cause may be network, player bug, or PRE change.
**Operator equivalent:** "It's showing the wrong thing," "there's a mismatch," "that screen is off"
**Gap analysis:** The technical meaning (replay divergence class) and the operational meaning (screen state divergence) are different concepts sharing the same word. This document uses "replay divergence" and "screen divergence" to disambiguate when context is unclear.
**Do not confuse with:** entropy (which is configuration drift, not output divergence)

---

### Entropy Score

**Layer:** system (operator-facing in health dashboards as a composite score)
**Definition:** A composite operational health score in [0, 100] computed from weighted metrics M-01 through M-12. Score of 100 = no detected entropy (all metrics at advisory-free levels). Score of 0 = maximum entropy across all tracked dimensions. Score is advisory-only — it informs operators, does not block actions.
**Operator equivalent:** "Health score," "content health," "scheduling health," (no established operator vocabulary — this is a new concept to introduce carefully)
**Gap analysis:** Operators will map entropy score to a school-grade or sports-score mental model (100 = good, 0 = bad, somewhere in the 60s is "fine"). This is broadly correct. However, they may interpret the score as "is the content correct?" rather than "is the configuration intent coherent?" — two different questions.
**Do not confuse with:** confidence score (per-screen PRE output confidence about physical playback), system health (infrastructure/uptime metrics; entropy score is purely about configuration state)

---

## Section 6 — Infrastructure and Devices

---

### Pi Appliance

**Layer:** both
**Definition (system):** A Raspberry Pi device (Pi 4B or Pi 5) running Chromium in kiosk mode as the physical player. Polls the manifest endpoint every 15 seconds. Has a local disk cache for offline resilience. Has a watchdog that reboots after 3 consecutive failures.
**Definition (operator):** "The box," "the player," "the thing behind the TV," "the Pi," "the device"
**Gap analysis:** Operators know the Pi exists and are comfortable calling it by various informal names. The key gap is the 3-failure/reboot behavior and the 15-second poll cycle — these are invisible system behaviors that explain symptoms operators encounter ("the screen went blank for a minute then came back").
**Do not confuse with:** screen (the logical system record; the Pi appliance drives one screen but is a different concept layer)

---

### Kiosk Mode

**Layer:** system (operator-facing: "display mode," "TV mode," "it's set up to just show content")
**Definition:** Chromium browser running in `--kiosk` flag with no browser UI, no cursor, no OS notifications, set to the correct player URL with screen_id parameter. The device boots directly into kiosk mode without user interaction.
**Gap analysis:** Operators don't need to know what kiosk mode is. Technicians do. This term belongs in technician training, not operator UX.
**Do not confuse with:** player (the JavaScript application running inside Chromium that handles manifest polling and content rendering)

---

### Cache

**Layer:** system (operator-facing: "offline mode," "it plays from memory if the internet goes down")
**Definition:** The local disk cache on the Pi appliance that stores the last known good manifest and content assets. Enables continued playback during network outages. The player serves cached content when the manifest endpoint is unreachable. Cache is cleared on checksum mismatch after reconnection.
**Definition (operator):** "Does it keep playing if the internet goes down?" (Yes) / "How long does it play for?" (Until it can reconnect or the cached content's windows expire)
**Gap analysis:** Operators care about "will it keep playing if there's a network issue?" The answer is yes, from cache, for the duration of the content's schedule windows. What they don't expect: if the cached content's schedule window expires during an outage, the cache will serve fallback content.
**Do not confuse with:** manifest cache (the server-side cache of PRE outputs, which accelerates polling; distinct from the client-side device cache)

---

## Section 7 — Operator Roles

---

### Org Admin

**Layer:** system
**Definition:** The highest privilege operator role. Has read/write access across all venues in an organization. Can create/delete venues, manage org-level campaigns, set org-level overrides, configure sponsorship contracts, and manage user accounts.
**Operator equivalent:** "Head office," "corporate admin," "the account owner," "IT admin"
**Gap analysis:** Org admins are often not the day-to-day operators. They set things up and hand over to venue managers. The configuration they create (org-level campaigns, org-level overrides) may be invisible to venue managers but affect all screens. This is a key entropy source.

---

### Venue Manager

**Layer:** system
**Definition:** Mid-privilege role. Full access within their assigned venue(s). Can create campaigns, schedules, overrides, emergency activations, and view all venue content. Cannot manage other users or create venues.
**Operator equivalent:** "The manager," "the venue manager," "the GM," "the marketing manager at the venue level"
**Gap analysis:** Venue managers are the primary operators. Most entropy patterns originate at this role level — not from malice, but from the combination of authority, time pressure, and incomplete system visibility.

---

### Shift Manager

**Layer:** system
**Definition:** Limited operator role. Can create and activate operational overrides within their venue. Cannot create campaigns, manage schedules, or activate emergencies without explicit promotion.
**Operator equivalent:** "The duty manager," "the bar manager," "the floor manager," "the person in charge tonight"
**Gap analysis:** Shift managers operate under time pressure during busy periods. They need fast, reliable tools for immediate content changes. Their natural workflow is: "I need this to show NOW on these TVs." The override system is their primary tool. Entropy risk: they create overrides without expiry dates, which persist after their shift.

---

### Sales Rep

**Layer:** system
**Definition:** Read-access plus campaign creation in draft mode. Cannot publish campaigns. Cannot create schedules or overrides. Exists to enable content creation without deployment authority.
**Operator equivalent:** "The sales team," "the account manager," "the person who sold the sponsorship"
**Gap analysis:** Sales reps often operate the CMS to fulfill promises made to clients. They understand content but not scheduling mechanics. They expect "create campaign" to mean "it's live" — the draft/publish distinction is invisible to them without explicit UX communication.

---

## Section 8 — Reserved and Deprecated Terms

---

### "It's scheduled" (deprecated mental model, not a system term)

**Definition:** The operator belief that "having a schedule" guarantees "content is playing." This belief is false — a schedule is an input to PRE resolution, not a guarantee of playback. Overrides, emergency activations, expired time windows, specificity losses, and priority losses can all cause a "scheduled" item to not resolve.
**Why documented:** This phrase appears constantly in operator communication and support tickets. "I scheduled it, why isn't it showing?" is the single most common support query pattern. Every UX surface must work to close this gap without requiring operators to understand the full PRE model.
**Correct framing:** "I've set up a schedule that the system will use when resolving content for these screens during the specified time window, assuming no higher-priority rule supersedes it."

---

### "Real-time" (operator expectation, not a system promise)

**Definition:** Operators use "real-time" to mean "immediately visible on the screen the moment I save." The system's reality is a 15-second poll cycle.
**Why documented:** Operator satisfaction is significantly affected by the expectation gap here. UX must clearly communicate "changes take effect within 15 seconds" and consider showing a countdown or "pending" state to manage this expectation.

---

### "Push" (operator desire, not a system mechanism)

**Definition:** Operators want to "push content to screens." The system architecture is poll-based, not push-based. There is no push mechanism. Players poll every 15 seconds.
**Why documented:** This expectation shapes how operators perceive latency. "I pushed it, why isn't it showing yet?" — the answer is "it will appear when the screen next polls, within 15 seconds." Consider surfacing "queued for next poll" states in UX.

---

### "Lock" (operator term, system equivalent: permanent override)

**Definition:** Operators say "lock that screen to X" meaning "make X play on that screen regardless of anything else." The system equivalent is a per-screen LEVEL_1 operational override with `expires_at = NULL`. The word "lock" implies reversibility and visibility that the system does not automatically provide — an override is not visually distinct from a schedule to someone who doesn't know to look.
**Why documented:** "Lock" implies both "exclusive control" and "temporary." Neither implication is fully accurate. Lock means "exclusive control until someone removes the override" — not temporary, and not automatically visible to area managers reviewing the area schedule.

---

---

## Section 9 — Missing Priority Terms (added 2026-05-24)

---

### Effective State

**Layer:** both
**Definition (system):** The actual resolved output of `PRE(screen_id, t, SystemState)` at a given moment — the specific playlist, its source level and rule, the confidence score, and the reason trace. Effective state is what IS, not what was configured. It may differ from what any single operator intended if multiple rules are active simultaneously.
**Definition (operator):** "What's actually playing," "what the screen is doing right now," "the current state"
**Gap analysis (critical):** Operators reason about configured state (what they set up) rather than effective state (what resolves). The most common support pattern — "I set it up, why isn't it showing?" — is a conflation of configured state with effective state. A campaign can be active and correctly configured while a per-screen override at LEVEL_1 prevents it from reaching effective state. Effective state is always the PRE output; configured state is only the inputs.
**Constitutional implications:** INV-1 (purity) and INV-3 (determinism) mean effective state is fully reproducible given the same inputs and time. INV-5 (level termination) means effective state is determined by exactly one winning level — all others are skipped and recorded in reason_trace.
**Do not confuse with:** configured state (what rules exist in the database — may differ from effective state), active rules (rules that are active but may not be winning resolution), delivery state (what the player has received — may lag effective state by up to one poll cycle)

---

### Suppression

**Layer:** system
**Definition:** The condition where a valid, active rule at a lower resolution level is prevented from contributing to effective state because a higher-level rule has terminated resolution first. The suppressed rule is not deleted, not errored, and not visible to the operator as "blocked" — it is simply not evaluated. The reason_trace records the terminating level and annotates lower levels as suppressed.
**Operator equivalent:** "It's being overridden," "the override is covering it," "the schedule is being blocked," "that campaign isn't showing even though it's published"
**Gap analysis (critical):** Suppression is the system's most invisible behavior to operators. An operator who publishes a campaign, sets it to active, confirms the schedule covers the right screens and times, and then sees other content playing will not spontaneously identify suppression as the cause. The UX obligation is to surface suppression explicitly: "This schedule is active but is currently suppressed by [override X at LEVEL_1 on screen Y]."
**Constitutional implications:** INV-5 (level termination) defines suppression behavior. INV-5.1 requires the terminating level to be recorded. Suppression is constitutional — it is the designed behavior of the priority hierarchy, not a fault.
**Do not confuse with:** deactivation (the rule has `status ≠ 'active'`; suppression means the rule is active but not winning), expiry (the rule's time window has passed; suppression is within a valid time window)

---

### Emergency Activation

**Layer:** both
**Definition (system):** The act of setting an `emergency_states` record to `status = 'active'`, causing all screens in the record's target scope to resolve at LEVEL_0 (Emergency Absoluteness) with the emergency content defined in that record. Emergency activation is immediate and total within scope — no poll latency applies to the activation itself (the next poll within ~15 seconds picks it up). Deactivation requires an explicit operator action.
**Definition (operator):** "Hitting the big red button," "taking over all screens," "broadcasting to everything," "locking everything down," "going into emergency mode"
**Gap analysis (critical):** Emergency activation is the fastest and most reliable way to guarantee all screens show a specific thing. Under operational pressure, operators use it for non-emergency purposes (sports night start, urgent promotion, urgent announcement). This is Emergency Semantic Collapse (M-06/M-12) — the emergency audit trail becomes worthless because it contains non-emergency events. UX must make emergency activation feel appropriately weighty, not just fast.
**Gap analysis (secondary):** Operators sometimes expect to choose content at activation time. The content is predetermined in the emergency record. "What will play?" is a question to answer before an emergency, not during one.
**Constitutional implications:** INV-7 (Emergency Absoluteness) — CATASTROPHIC severity. Emergency activation at LEVEL_0 cannot be overridden by any other rule, any operator action short of deactivation, or any configuration. This is the hardest constitutional invariant.
**Do not confuse with:** override (LEVEL_1/2 — operator-selected content with scope and expiry; emergency is LEVEL_0 — system-defined content, absolute within scope), activation (the generic lifecycle state change to `status = 'active'`; Emergency Activation is specifically the emergency state)

---

### Schedule Block

**Layer:** operator (system equivalent: schedule row with time window)
**Definition (operator):** The operator mental model of a unit of scheduled content — "a block of time when X plays." Operators think in blocks: "I've set up a block for the game tonight," "there's a two-hour block for the promotion." A schedule block corresponds to one or more schedule rows in the `schedules` table with a defined `starts_at`, `ends_at`, and content reference.
**Definition (system):** The system has no formal "Schedule Block" entity. The operator concept maps to: a schedule row (single block), a group of schedule rows with the same campaign_id and time parameters (campaign-generated block series), or an override with a time window (bounded override block).
**Gap analysis:** "Block" is a useful operator abstraction that the system doesn't expose directly. Operators create blocks by creating schedule rows; they don't see the rows — they see the block. When multiple rows overlap, the "block" mental model breaks down and operators are confused by which block is winning.
**Constitutional implications:** None directly. The importance is vocabulary alignment — when an operator says "I set up a block for X" they mean "I created schedule rows that I expect to produce X at those times." Whether X actually appears depends on resolution, which they do not mean.
**Do not confuse with:** schedule (the database row), campaign (the parent intent object that may generate multiple schedule blocks), time window (the `starts_at`/`ends_at` pair that defines a block's boundaries)

---

### Sponsorship Window

**Layer:** both
**Definition (system):** The time period during which a `sponsorship_contract` record is active: `starts_at` to `ends_at`. During the sponsorship window, the PRE evaluates the contract at LEVEL_4 (Sponsorship Injection) and additively injects sponsor content into the base playlist according to the contracted SOV and SWRR weighting. Outside the window, the contract does not participate in resolution regardless of its `status`.
**Definition (operator):** "When the sponsor deal is running," "the campaign period," "the sponsorship dates," "the contract window"
**Gap analysis:** Operators understand the concept but may not know the precise system behavior: sponsorship is additive (it modifies the existing playlist, it does not replace it), it operates at a specific resolution level (LEVEL_4), and SOV is a target percentage, not a guaranteed exact frequency. A sponsor with 15% SOV will appear in approximately 15% of content slots, not exactly every 7th slot.
**Constitutional implications:** LEVEL_4 injection is additive — it cannot reduce non-sponsor content to zero (that would require LEVEL_0/1/2 control). INV-6 (No Amplification) prevents the confidence score from claiming higher certainty about sponsor delivery than the delivery log supports.
**Do not confuse with:** override (LEVEL_1/2 — can replace all content; sponsorship at LEVEL_4 is additive), schedule (LEVEL_3 — defines the base playlist into which sponsorship is injected), active (a contract can be `status = 'active'` outside its sponsorship window and will not inject)

---

### SWRR (Smooth Weighted Round Robin)

**Layer:** system
**Definition:** The playlist interleaving algorithm used by the PRE to produce smooth, predictable content ordering when multiple playlist items have different weights. SWRR distributes items proportional to their weight while avoiding long runs of the same item. An item with weight 3 and an item with weight 1 will produce approximately the sequence [A, A, B, A, A, B, ...] rather than [A, A, A, A, B] — the weight is honored but the distribution is smooth.
**Operator equivalent:** "How often things play," "the mix," "the rotation," "how the content is spread out"
**Gap analysis:** Operators understand frequency but not the algorithm. They expect that "weight 3 vs weight 1" means "3 times as often" — which is true of total frequency but not of sequential position. The smoothing behavior is invisible to operators but prevents the bad experience of watching the same item three times in a row before seeing anything else.
**Constitutional implications:** SWRR is part of the PRE behavioral specification (Agent 1 authority). The Glossary documents the operator-facing vocabulary; the algorithm is governed by the PRE specification. Any change to SWRR semantics requires Agent 1 review and corpus regression.
**Do not confuse with:** priority (ordering within LEVEL_3 for which schedule wins when multiple compete; SWRR operates after resolution, on the winning playlist), weight (the input to SWRR; SWRR is the algorithm that uses weight), SOV (sponsor share-of-voice — the contract-level target percentage that determines sponsor weight in SWRR injection)

---

### Suppression Tree

**Layer:** system (operator-facing in explainability surfaces)
**Definition:** The structured representation of why content is not playing on a screen — the complete record of which rules were evaluated, which suppressed which, and which rule terminated resolution. The suppression tree is the primary surface in the Explainability UX (EXPLAINABILITY-UX-SPEC-v1.md) for answering Q4 "Why is X NOT playing?" — the most operationally critical explainability question.
**Operator equivalent:** "Why isn't my campaign showing?", "why isn't this schedule doing anything?", "can you show me what's blocking it?"
**Gap analysis:** Operators can construct a partial suppression tree mentally ("I think there's an override somewhere") but cannot see the full tree without tooling. The primary operator failure mode is incorrect root-cause attribution — blaming the schedule when the cause is an override three layers up in the targeting hierarchy.
**Constitutional implications:** INV-5 (level termination) requires reason_trace to record enough information to reconstruct the suppression tree. Explainability is a constitutional obligation (Engineering Constitution §2.2).
**Do not confuse with:** reason trace (the raw structured field in PRE_Output; suppression tree is the human-readable UX rendering of reason_trace), audit log (who changed configuration; suppression tree is why the current configuration produces its current output)

---

*End of DOMAIN-LANGUAGE-GLOSSARY.md v1.1*
*Append new entries; do not delete or overwrite existing entries.*
*Flag outdated entries with: `[OUTDATED — see <replacement term>]`*
