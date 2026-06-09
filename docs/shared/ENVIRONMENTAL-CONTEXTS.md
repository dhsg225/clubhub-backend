# ClubHub TV — Environmental Contexts
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document models the physical and operational environments in which ClubHub TV screens operate. Content displayed on a screen in a quiet hotel lobby is consumed in a completely different perceptual context than content on a screen in a noisy sports bar. Screen use case design, content requirements, and operator UX must account for these environmental realities.

This is NOT a hardware specification document. It is an operational intelligence model of the viewing environment — how content is experienced, how attention is structured, and what constraints the environment places on what content can and cannot communicate effectively.

---

## Governing Philosophy

**Screens are environments, not canvases.** A screen in a venue is embedded in a physical, social, and operational context that fundamentally shapes what can be communicated. Content designed without understanding its environment will fail to communicate even when technically correct.

**Attention is the primary constraint.** The question "will anyone read this?" must be answered before "does this look good?" in every content design and scheduling decision.

**Network reliability and physical stability are not assumptions.** Venue environments vary enormously in network quality, power stability, and physical installation quality. These variations directly affect what the system can reliably deliver and what operators can safely depend on.

---

## Section 1 — Physical Environment Taxonomy

### 1.1 Ambient Light Conditions

**DARK_INTERIOR**
- Description: Dim interior lighting, controlled ambience (gaming rooms, late-night bars, nightclubs).
- Screen brightness requirement: Low-to-medium. High brightness creates eye strain and breaks ambience.
- Content implication: High-contrast content works well. Bright full-screen whites are uncomfortable. Dark-theme UI preferred.
- Examples: Gaming areas, nightclubs, intimate bar spaces.

**STANDARD_INTERIOR**
- Description: Normal interior commercial lighting (typical bar, restaurant, lobby).
- Screen brightness requirement: Medium. Factory-default is usually appropriate.
- Content implication: All content types work. Standard design guidelines apply.
- Examples: Most indoor venue areas.

**BRIGHT_INTERIOR**
- Description: High-intensity lighting (hospital waiting rooms, sports facilities, modern open-plan restaurants).
- Screen brightness requirement: High. Low-brightness screens are washed out.
- Content implication: High contrast required. Fine text at small sizes becomes unreadable. Bold, high-contrast typography essential.
- Examples: Medical waiting rooms, gym reception, bright hotel lobbies.

**OUTDOOR_COVERED**
- Description: Covered outdoor space (undercover bar, covered pool area, undercover sports area). Variable light conditions.
- Screen brightness requirement: HIGH, often maximum. Sun angle and reflections are key variables.
- Content implication: Simplified content required. Complex graphics and small text unreadable. Bold, high-contrast, minimal text.
- Examples: Beer gardens, pool bars, covered golf course areas.
- Technical constraint: Screens in this environment must be weatherproof-rated or protected. Not all screen hardware is suitable. Network reliability varies significantly.

**OUTDOOR_EXPOSED**
- Description: Fully exposed outdoor environment (outdoor signage, exposed course displays).
- Screen brightness requirement: MAXIMUM. Visibility in full sun requires industrial-grade displays.
- Content implication: Only the simplest content is legible. Text must be very large, very high contrast. Animation may reduce readability.
- Technical constraint: Industrial display hardware required. Temperature management critical. Significantly higher hardware cost and maintenance requirement.
- **Note for system design:** Content scheduled for outdoor-exposed screens should be validated against outdoor content standards. Standard venue content may be entirely inappropriate here.

### 1.2 Noise Level

**QUIET (< 50dB)**
- Environments: Hotel lobbies, medical waiting rooms, library, spa areas, fine dining.
- Content implication: Text can be longer. Animation should be subtle. Jarring transitions inappropriate. Audio content (if ever enabled) must be silent or very low.
- Operator expectation: Premium aesthetic, calm experience, brand-consistent.

**MODERATE (50–70dB)**
- Environments: Casual dining, general bar, golf club bar, office lobbies.
- Content implication: Text should be scannable (3–6 seconds maximum). Animation can be more dynamic. No audio assumed.

**LOUD (70–85dB)**
- Environments: Active bar, nightclub, sports bar during events, gaming floor.
- Content implication: Text must be VERY brief (2–3 seconds maximum). Large type only. Animation must communicate without reading. Sound is irrelevant — pure visual communication.
- Key insight: In loud environments, a viewer who looks at the screen has approximately 2 seconds before social/environmental distraction reclaims their attention. Content must communicate its full message in that window.

**VERY LOUD (85dB+)**
- Environments: Live entertainment venue, peak sports bar event.
- Content implication: Visual impact only. Text is read by almost nobody. The screen functions as atmosphere, not information. Bold graphics, moving visuals, strong brand color.
- Operator expectation: "It looks great" is the success criterion, not "it communicates the specials."

### 1.3 Viewer Dwell Time

**TRANSIENT (< 30 seconds)**
- Environments: Corridors, elevator lobbies, entranceways, checkout queues.
- Content implication: One idea per content item. 6–15 seconds per slide maximum. No multi-step information sequences.
- PRE consideration: Short duration_ms values appropriate. The SWRR playlist interleaves quickly — every viewer gets a sample of the content mix without seeing the full cycle.

**BRIEF (30 seconds – 5 minutes)**
- Environments: Hotel lobby check-in wait, bar queue, concierge desk wait.
- Content implication: Content cycle of 3–8 items. Core information in first 3 seconds, detail available for interested viewers.

**MODERATE (5–20 minutes)**
- Environments: Waiting rooms, bistro waiting, pre-event gathering area.
- Content implication: Longer content cycle. Can include multiple related pieces. Repetition will be noticed by longer-dwelling viewers — avoid obvious short loops.

**EXTENDED (20 minutes+)**
- Environments: Seated dining, waiting rooms (medical), sports watching.
- Content implication: Viewers will see the full content cycle multiple times. Content loop must be long enough (30+ minutes) that repetition is tolerable. Fresh content updates must happen regularly enough that the loop doesn't become stale during extended dwell.
- PRE consideration: Playlist diversity is important. SWRR weighting must produce visible variety within a reasonable window.

### 1.4 Viewer Attention Mode

**PASSIVE-AMBIENT**
- Definition: Screen is part of the background. Viewers are not watching it intentionally.
- Environments: Background screens in busy bars, gaming area periphery, corridor screens.
- Content effectiveness: Only striking visuals or movement captures occasional attention. Text is rarely read. Brand impression is the primary communication.

**IDLE-WAITING**
- Definition: Viewer is waiting for something and has nothing else to focus on. Screen fills idle attention.
- Environments: Waiting rooms, queue lines, slow-service contexts.
- Content effectiveness: Text IS read. Sequences ARE followed. Information can be complex.
- Highest information communication potential of any attention mode.

**SOCIAL-DISTRACTED**
- Definition: Viewer is in social conversation and glances at screen occasionally.
- Environments: Social bar, restaurant table, group seating.
- Content effectiveness: Glances of 1–3 seconds. Must communicate in first 2 seconds or not at all. No text sequences. Brand and visual impact only.

**TASK-ENGAGED**
- Definition: Viewer is completing a task (choosing from menu, checking in, registering) and screen is informational support.
- Environments: Menu boards (restaurant/bar), check-in lobby, registration desk.
- Content effectiveness: Viewer is actively seeking information. Text is read carefully. Accuracy is critical.
- Highest consequence of information error.

**ENTERTAINMENT-WATCHING**
- Definition: Viewer is intentionally watching the screen for entertainment (sports, live event coverage, scheduled entertainment).
- Environments: Sports bar (primary screens), event rooms, live screening areas.
- Content effectiveness: Full engagement. But content that competes with or interferes with the primary entertainment creates negative experience.

---

## Section 2 — Network Environment Profiles

### 2.1 Network Reliability Taxonomy

**ENTERPRISE_WIRED**
- Description: Wired Ethernet on managed infrastructure. Consistent latency, high bandwidth, monitored.
- Poll reliability: >99.9%. Manifest delivery is essentially guaranteed.
- Failure mode: Physical cable failure, switch failure — infrequent, typically monitored.
- Appropriate for: Any deployment where reliability is operationally critical.

**VENUE_WIRED**
- Description: Wired Ethernet on consumer/SOHO router. Not managed infrastructure.
- Poll reliability: 95–99%. Brief outages from router restarts, ISP issues.
- Failure mode: Router restarts, ISP outages (typically 15 minutes to 2 hours). Cache handles most outages.
- Appropriate for: Standard venue deployments.

**VENUE_WIFI_5GHZ**
- Description: 5GHz WiFi with WPA2/3. Reasonable but not enterprise grade.
- Poll reliability: 90–97%. Interference from competing SSIDs, physical obstacles.
- Failure mode: Interference-driven drops (short duration), AP restarts, roaming events.
- **Risk:** WiFi reliability in venue environments is significantly lower than wired. 2.4GHz WiFi in a venue with multiple competing networks (venue WiFi + customer WiFi + surrounding businesses) is unreliable.
- Appropriate for: Screens where wired is not feasible. Not for gaming area compliance screens.

**VENUE_WIFI_24GHZ**
- Description: 2.4GHz WiFi in venue environment.
- Poll reliability: 70–90%. Significant interference risk.
- Failure mode: Frequent short drops (10–30 seconds). Cache may be insufficient for persistent content display.
- **NOT RECOMMENDED for production deployments.** The pilot venue checklist flags this explicitly.

**MOBILE_HOTSPOT**
- Description: 4G/5G mobile data. Suitable for temporary or remote deployments.
- Poll reliability: 80–95%. Dependent on carrier coverage.
- Failure mode: Coverage gaps, data limit exhaustion, SIM issues.
- **Cost risk:** Mobile data plans may be exceeded by polling frequency over time. Should be monitored.

### 2.2 Network Failure Response Behavior

**Current behavior:**
- Player polls every 15 seconds.
- On manifest endpoint failure: player uses cached manifest and continues playback.
- Cache is valid until schedule windows within the cached manifest expire.
- When cached schedule windows expire during an outage: player falls back to system fallback content.
- On reconnection: player polls immediately and fetches current manifest.

**Operator expectation:**
- "It keeps playing if the internet goes down." (Correct — within cache validity.)
- "It comes back when the internet comes back." (Correct — within one poll cycle.)
- "The right content shows even during an outage." (Correct for short outages; may show fallback for long outages if scheduled windows expire.)

**Operator misunderstanding to address:**
- Long outages during which scheduled content windows expire will result in fallback content playing — even after reconnection — until the operator reviews and updates the schedule. This is correct constitutional behavior but unexpected to operators.

### 2.3 Environmental Interference Sources

**Gaming rooms:** EGM machines emit significant electromagnetic interference. Network equipment near gaming machines may experience reliability issues. This is a documented venue-type-specific risk.

**Kitchen/service areas:** Commercial kitchen equipment (microwaves, commercial refrigerators, induction cooktops) can cause WiFi interference. Screens near kitchens should use wired connections.

**Event spaces during events:** Large gatherings bring high density of mobile devices causing significant WiFi congestion. Event screens should be on wired connections.

**Outdoor areas:** Solar radiation, temperature extremes, and physical obstacles create network reliability challenges for outdoor screens.

---

## Section 3 — Physical Installation Environment

### 3.1 Viewing Distance and Typography

**Close range (< 2 meters):** Minimum type size: 18pt / 24px. Fine detail visible. Full information display possible.

**Medium range (2–5 meters):** Minimum type size: 36pt / 48px. Body text at 24pt is marginal. Headline-and-summary layouts only.

**Long range (5–10 meters):** Minimum type size: 72pt / 96px. Only headlines and large graphics effective.

**Very long range (10+ meters):** Minimum type size: 144pt / 192px. Text-based information is effectively unreadable. Brand/imagery only.

**System design implication:** The ClubHub system does not currently know the viewing distance of any given screen. Content items are designed without environmental context. A content item designed for close-range (text-heavy, small type) will fail at long range. Future platform design should consider screen environmental metadata (viewing_distance, environment_type) that influences content scheduling and advisory UX.

### 3.2 Screen Orientation and Aspect Ratio

**Standard landscape (16:9, 1920×1080 or 3840×2160):** The overwhelming majority of venue screens. Standard content design target.

**Portrait (9:16):** Used in some corridor, retail, and digital signage contexts. Content designed for landscape does not work in portrait. Portrait screens require portrait-specific content items.

**Non-standard aspect ratios:** Some commercial displays have 21:9 or other ratios. ClubHub content is standardized on 16:9; non-standard ratios require either pillarboxing/letterboxing or custom content.

**Multiple screens as a single display (video wall):** Some venues (sports bars, function rooms) run multiple screens as a single video wall. ClubHub cannot directly manage multi-screen synchronized content — each screen operates as an independent unit. This is a design gap for high-end sports bar or function room deployments.

### 3.3 Physical Screen Location Constraints

**Height mounting:** Screens mounted above eye level (typical in bars and clubs) require content designed with the viewing angle in mind. Content designed at eye level may look visually incorrect when viewed from below.

**Reflective surfaces:** Shiny floors, glass walls, or wet surfaces near screens create reflections that reduce legibility. Content must have sufficient contrast to remain legible under reflection conditions.

**Adjacent screen proximity:** In multi-screen environments, adjacent screens showing different content can create visual conflict. Some content transitions should be coordinated between adjacent screens (particularly in event environments) — a design consideration for future platform capability.

**TV input competition:** Venue screens are often shared between ClubHub (via Pi HDMI) and live TV/sports (via set-top box or IPTV). The Pi occupies one HDMI input. Operators switch inputs manually. This creates a flow:
1. Shift manager wants live sport → switches TV to sports input → ClubHub is "off" on that screen.
2. After the game → staff forget to switch back → ClubHub remains "off" indefinitely.
3. Nobody notices because the screen is "showing something" (sports broadcast, or later: standby).

**Implication:** The delivery log confidence score for a screen that has been switched to a different HDMI input will degrade over time (no delivery log updates). This signal — low confidence on screens in a sports venue during/after a sports event — is a useful heuristic for detecting HDMI-switched screens. Future feature: "Screen may have been switched to another input — no delivery confirmation in X hours."

---

## Section 4 — Temporal Environmental Factors

### 4.1 Daypart Environmental Shifts

Many venue environments change character significantly across the day. The same physical space may have different ambient light, noise level, and viewer attention mode at different hours.

**Example: Club gaming room**
- Midday: Quiet, few patrons, IDLE-WAITING attention, STANDARD_INTERIOR lighting.
- Evening peak: Crowded, LOUD, PASSIVE-AMBIENT attention, DARK_INTERIOR lighting.
- Late night: Variable — may be very quiet or still crowded.

**Implication:** Content that is appropriate for the midday gaming room may be inappropriate for the peak evening gaming room. The ClubHub schedule system supports time-of-day windowing — this should be used to deliver context-appropriate content across daypart shifts.

**System design consideration:** The PRE correctly evaluates time-of-day constraints using venue local time. Operators who configure daypart schedules are using the system correctly. The entropy risk is that operators who don't know about time-of-day windowing run the same content 24 hours a day, regardless of environmental shifts.

### 4.2 Seasonal Environmental Shifts

**Outdoor areas:** Dramatically different in summer vs winter. A pool bar screen that receives excellent visibility in summer may be completely unused (and therefore an entropy accumulation risk) in winter.

**Lighting transitions:** Shorter daylight hours in winter shift the indoor-outdoor light balance. Screens that were "background" in bright summer light become more prominent in darker winter conditions.

**Event seasonality:** Sports seasons, holiday periods, and local event calendars create predictable spikes in content urgency that repeat annually. Future platform design should consider seasonal content scheduling templates — pre-built campaign structures for known recurring periods.

### 4.3 Live Event Environmental Transformation

During a large live event (sports final, concert, special member function), a venue's operational environment can transform completely:

- Noise level: Escalates from MODERATE to VERY LOUD.
- Attention mode: Shifts from SOCIAL-DISTRACTED to ENTERTAINMENT-WATCHING (primary screens) and PASSIVE-AMBIENT (peripheral screens).
- Screen priority: Changes — some screens become primary entertainment surfaces, others become secondary atmosphere.
- Operator urgency: Escalates dramatically — minute-by-minute content changes expected.
- Network load: Increases significantly from patron mobile device usage.

**PRE behavior during events:** The PRE resolves correctly throughout. The operational challenge is that the override/emergency tools available to operators are not designed for the dynamic, real-time content choreography that event environments demand. This is a platform design gap — event-mode content management is a future capability requirement.

---

## Section 5 — Environmental Metadata Model (Future Platform Design)

### 5.1 Proposed Screen Environmental Metadata

Future versions of the platform should support attaching environmental metadata to screen records. This metadata would inform advisory UX, content recommendations, and entropy signals.

**Proposed fields on `screens` table:**

```
environment_type      ENUM: gaming | bar | dining | lobby | corridor | outdoor_covered | outdoor_exposed | conference | other
viewing_distance_m    INTEGER: approximate typical viewing distance in meters
ambient_light         ENUM: dark_interior | standard_interior | bright_interior | outdoor_covered | outdoor_exposed
noise_level           ENUM: quiet | moderate | loud | very_loud
primary_use           ENUM: ambient | idle_wait | entertainment | menu_board | information
is_compliance_screen  BOOLEAN: true if screen is subject to regulatory content requirements
is_outdoor            BOOLEAN: derived from environment_type but explicit for query convenience
shares_display_input  BOOLEAN: true if screen is shared with a non-ClubHub input (live TV, etc.)
```

### 5.2 How Environmental Metadata Would Be Used

**Content advisory:** When creating a content item with 200 words of text, the system detects that it is being scheduled for screens with `viewing_distance_m > 5` or `noise_level = very_loud`, and surfaces an advisory: "This content may not be legible at the screen's typical viewing distance / in the screen's noise environment."

**Duration advisory:** When scheduling a 30-second content item on a screen with `primary_use = ambient`, the system surfaces: "Ambient screens typically benefit from shorter content items (6–15 seconds). This item is 30 seconds."

**Compliance monitoring:** Screens with `is_compliance_screen = true` get enhanced monitoring — any gap in scheduled content generates an immediate advisory rather than waiting for entropy threshold.

**Confidence score calibration:** Screens with `shares_display_input = true` get modified confidence score thresholds — low delivery confirmation is expected on these screens during live events.

### 5.3 Implementation Priority

This environmental metadata model is a future design feature, not a current implementation requirement. It is documented here to:
1. Ensure the data model design doesn't preclude adding these fields.
2. Ensure content and scheduling UX is designed with this future capability in mind.
3. Provide Agent 3 with the environmental framework for UX design decisions before this metadata exists in the system.

Until environmental metadata is available, UX design for operators should use vertical-level environmental defaults (from MARKET-VERTICAL-PATTERNS.md) as proxies.

---

*End of ENVIRONMENTAL-CONTEXTS.md v1.0*
*Append new environment profiles and update existing profiles as deployment experience accumulates.*
*Environmental metadata model in Section 5 should be revisited for implementation priority after first 10 venue deployments.*
