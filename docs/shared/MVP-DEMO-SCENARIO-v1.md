# MVP Demo Scenario v1
## ClubHub TV — Operator CMS First Working Demo

**Document type:** Runnable demo script
**Audience:** Product stakeholders, engineering leads, operations
**Demo duration:** ~28 minutes total (6 acts)
**Last updated:** 2026-06-04
**Status:** AUTHORITATIVE — do not alter sequence without updating expected outcomes

---

## Prerequisites

- Demo environment running at `https://[demo-host]`
- Seed data loaded: `npm run seed:demo`
- Browser 1: logged in as "Alex" (OPERATOR)
- Browser 2 (Act 4 only): logged in as "Jordan" (OPERATOR)
- Demo operator has access to backend trigger scripts (see Act 1.6, 2.1, 6.2)
- All 6 System Status Bar indicators confirmed green before starting

---

## 1. Demo Environment Setup

### 1.1 Seed Data — Venues

| Field | venue-001 | venue-002 | venue-003 |
|---|---|---|---|
| Name | The Crown & Anchor | Pitch Side Bar | The Sports Lounge |
| machine_state | LIVE | OFFLINE | RECOVERED_BUT_UNTRUSTED |
| location | Manchester, UK | Leeds, UK | Sheffield, UK |
| screen_count | 4 | 2 | 3 |
| Zone A dot | solid green | grey/offline indicator | ↻ orange-400 rotating |

**venue-002 autonomy clock:** 18 hours 23 minutes remaining (serving offline corpus). Clock is live-counting down.

**venue-003 corpus state:** hash not yet verified against server-authoritative corpus. Override controls absent from DOM until state transitions to LIVE.

### 1.2 Seed Data — Active Incidents

**incident-001** (pre-existing, lower severity — visible in Zone A IncidentList):
- venue: venue-001 (The Crown & Anchor)
- severity: S3 MAJOR
- state: ACTIVE
- commander: none assigned
- created: 23 minutes before demo start
- Tab 2 notes: "PRE dropped to L3 during the 19:00 fixture. Content recovery in progress."

**incident-002:** Created live during Act 2 via backend trigger script.

### 1.3 Seed Data — Content Calendar

**venue-001 — Saturday 20:00–22:00:**
- title: "Premier League Highlights — Match Day 38"
- delivery_priority: HIGH_PRIORITY
- declared by: "Sarah K."
- display: ★ prefix in calendar

**venue-001 — Sunday 14:00–16:00:**
- title: "Sunday Sports Roundup"
- delivery_priority: ROUTINE
- display: no prefix, sorted below ★ entries

**venue-002 — Saturday 20:00–22:00:**
- state: empty (no content scheduled)
- display: empty slot, visually distinct from filled slots

### 1.4 Seed Data — Operators

| Field | Demo User A | Demo User B |
|---|---|---|
| Name | Alex | Jordan |
| Role | OPERATOR | OPERATOR |
| Browser | Browser 1 (primary) | Browser 2 (Act 4 only) |

### 1.5 System Health at Demo Start

- constitutional_state: HEALTHY
- System Status Bar: all 6 indicators green
- No active S1 or S2 incidents
- Entropy score within normal operating range
- Corpus delivery pipeline: no pending HIGH_PRIORITY warnings at demo start (venue-001 Saturday slot is >72h out)

---

## 2. Demo Act 1 — Venue Health Monitoring (5 minutes)

**Scene:** Alex logs in and sees the live fleet state across all three venues.

**Purpose for stakeholders:** Establish that the system shows real-time venue health without page refreshes, and that different machine states are visually distinct.

---

### Step 1.1 — Navigate to Live Ops

**Alex navigates to:** `https://[demo-host]/ops/live`

**Expected outcome:**
- Login page renders.
- No venues visible yet.
- No Zone A content until authenticated.

---

### Step 1.2 — Log In as Alex (OPERATOR)

**Alex logs in with OPERATOR credentials for "Alex".**

**Expected outcome:**
- Shell renders. Zone chrome is visible:
  - System Status Bar (48px top): HEALTHY — all 6 indicators green.
  - Zone A (280px left): VenueSelector, IncidentList, NotificationTray, OperatorTools.
  - Zone B (fluid center): Live Ops surface placeholder (no venue selected yet).
  - Zone C (320px right): empty or default state.
- VenueSelector in Zone A shows exactly 3 venues:
  - "The Crown & Anchor" — solid green dot (LIVE)
  - "Pitch Side Bar" — grey/offline indicator (OFFLINE)
  - "The Sports Lounge" — ↻ rotating dot, color `#FB923C` (orange-400), RECOVERED_BUT_UNTRUSTED (PATCH-007)
- Zone A IncidentList shows incident-001 (S3 MAJOR, Crown & Anchor, 23m).
- NotificationTray badge: 0 (no new notifications yet).

**Talking point (stakeholders):** "As soon as you log in, you can see the health of every venue at a glance. The rotating orange dot means that venue came back online but hasn't been verified yet — the system is protecting you from pushing content to an uncertain venue."

---

### Step 1.3 — Select The Crown & Anchor (LIVE venue)

**Alex clicks "The Crown & Anchor" in Zone A VenueSelector.**

**Expected outcome:**
- Zone B switches to Live Ops surface for venue-001.
- Venue Identity Header in Zone B: "The Crown & Anchor — LIVE" with green LIVE badge.
- Zone B Section 1 (Intervention Surface): no active L6 override. Override placement button visible.
- Zone B Section 2 (Player Status): 4 player status cards, each showing screen ID, playback state, and last heartbeat.
- Zone B Section 2 (Signal Quality): 3 signal quality cards.
- PATCH-019 section labels visible: "PLAYER STATUS" (above player cards), "SIGNAL QUALITY" (above signal cards).
- Zone C: Advisory (Pane C4) shows informational advisory — no border treatment.

---

### Step 1.4 — Select Pitch Side Bar (OFFLINE venue)

**Alex clicks "Pitch Side Bar" in Zone A VenueSelector.**

**Expected outcome:**
- Zone B switches to venue-002.
- Venue Identity Header: "Pitch Side Bar — OFFLINE" with OFFLINE machine state badge.
- Autonomy clock visible in Zone B (PATCH-011): "⏱ 18h 23m remaining — serving offline corpus"
  - Color: amber (more than 6 hours remaining; clock turns red below 6h).
  - Clock is counting down in real time — no page refresh required.
- Intervention Surface: override controls present but venue is OFFLINE — behavior note visible.
- Player status cards: show last known state (may show DISCONNECTED).

**Talking point (stakeholders):** "This venue lost its connection 18 hours ago, but it's still running. The player on-site has a local corpus — a pre-loaded set of content — that it serves autonomously. The clock tells us exactly how long before it runs out. We have time to act."

**Talking point (engineering):** "Autonomy clock delta is computed from last_heartbeat timestamp server-side. The client receives the server-authoritative value and counts down locally — no drift from client clock."

---

### Step 1.5 — Select The Sports Lounge (RECOVERED_BUT_UNTRUSTED venue)

**Alex clicks "The Sports Lounge" in Zone A VenueSelector.**

**Expected outcome:**
- Zone B switches to venue-003.
- Venue Identity Header: amber "LIVE — UNVERIFIED" pill badge (PATCH-009), 180×40px.
- Zone B Intervention Surface: L6 override placement button is **absent from DOM** (not disabled — the element does not exist). RECOVERED_BUT_UNTRUSTED guard is active. A contextual notice reads: "Override controls unavailable — corpus verification in progress."
- Zone A dot for Sports Lounge: ↻ rotating, `#FB923C` orange-400 (PATCH-007).
- Zone C advisory (Pane C4): may show "Corpus verification pending for The Sports Lounge."

**Talking point (stakeholders):** "The orange spinning dot means the venue came back online but we haven't confirmed its content is correct yet. Until the corpus hash is verified, the system locks out emergency overrides — it prevents us from sending commands to a venue whose state we don't fully trust."

**Talking point (engineering):** "IC-03 applies here: write controls are absent from DOM, not disabled. A DOM inspector will confirm there is no button element — not a disabled button."

---

### Step 1.6 — Live State Transition: RECOVERED_BUT_UNTRUSTED → LIVE

**[Demo operator action — run backend trigger script]**

```bash
# Trigger corpus hash verification success for venue-003
POST /admin/demo/trigger/venue-verified?venue_id=venue-003
```

**Expected outcome (within 2 seconds, no page refresh):**
- Zone A dot for "The Sports Lounge" changes from ↻ orange rotating to solid green (LIVE).
- Zone B machine state badge for venue-003 changes from amber "LIVE — UNVERIFIED" pill to green "LIVE" pill.
- Intervention Surface in Zone B: L6 override placement button **appears** in DOM.
- Zone C advisory (if applicable) clears or updates to "Corpus verified — venue operational."

**Talking point (stakeholders):** "Real-time — no refresh needed. The venue verified itself, the server pushed the update, and the interface reflects it within two seconds. The system knows the venue is safe to operate again."

**Talking point (engineering):** "Zone A dot state is driven by a WebSocket channel — `venue_state_update` event. The server pushes changes; the client never polls. The DOM update is a direct React state change on the incoming message."

---

## 3. Demo Act 2 — Incident Response (8 minutes)

**Scene:** Alex is viewing venue-003 (now LIVE) when an S2 CRITICAL incident fires on venue-001. The system automatically brings Alex to Incident Command.

**Purpose for stakeholders:** Show that the system responds to emergencies without requiring the operator to navigate — and that command authority is explicit and single-owner.

---

### Step 2.1 — S2 Incident Declaration on venue-001

**Alex is viewing "The Sports Lounge" (venue-003, now LIVE).**

**[Demo operator action — run backend trigger script]**

```bash
# Declare S2 CRITICAL incident on venue-001
POST /admin/demo/trigger/incident?venue_id=venue-001&severity=S2&incident_id=incident-002
```

**Expected outcome (before Zone B auto-replace fires):**
- Zone A: Crown & Anchor venue label gets an S2 severity badge (`#E64A19`, deep-orange).
- Zone A IncidentList: incident-002 entry appears at top (sorted by severity, then recency).
- NotificationTray badge increments.

---

### Step 2.2 — Zone B Auto-Replace to Incident Command

**S2 incident triggers automatic IC surface redirect (no operator action required).**

**Expected outcome:**
- Zone B content is replaced by Incident Command surface for incident-002.
- Alex did not click anything — the system navigated automatically.
- PATCH-014 contextual banner at Zone B bottom: "You were automatically brought here — [View Venue Dashboard →]"
  - This banner allows Alex to return to venue-003's dashboard if needed.
  - Banner persists until dismissed or Alex navigates manually.
- Zone A: Crown & Anchor badge is now deep-orange `#E64A19` (S2 severity color, PATCH-004).
- System Status Bar: updates to reflect active S2. At least one indicator changes from green.

**Talking point (stakeholders):** "Alex didn't navigate anywhere — the system brought him to the emergency automatically. He was looking at a different venue entirely. When an S2 fires, no operator should have to hunt for the right screen."

**Talking point (engineering):** "Zone B auto-replace is triggered by an S2 or S1 incident event on the WebSocket channel. The routing logic checks if the operator has an active IC session already — if not, it replaces Zone B and records the navigation source so the 'return' link works."

---

### Step 2.3 — Read the Incident Identity Bar

**Alex reads the Incident Identity Bar at the top of the IC surface.**

**Expected outcome:**
- "S2 CRITICAL" badge — color `#E64A19` (deep-orange).
- Venue name: "The Crown & Anchor"
- Incident ID: "INC-CRW-002"
- Duration: "0m 12s" (counting up in real time)
- Commander: "No commander assigned"
- [Assume Command] button visible and active.

---

### Step 2.4 — Alex Clicks [Assume Command]

**Alex clicks [Assume Command].**

**Expected outcome:**
- AssumeCommandConfirmCard renders in Zone B (replaces or overlays the IC surface).
- PATCH-003 context strip at top of card:
  - "[S2 CRITICAL] INC-CRW-002 / The Crown & Anchor / 0m 47s / No commander / [Level 1 alert in 14m 13s]"
  - Duration and alert countdown are live-updating while the confirm card is open.
- Two buttons: [Confirm — Assume Command] and [Cancel].

**Talking point (stakeholders):** "Before Alex can take command, the system shows him exactly what he's taking on — the severity, how long the incident has been running, and how long until the next escalation. This isn't a blocker — it's context."

---

### Step 2.5 — Alex Confirms Command

**Alex clicks [Confirm — Assume Command].**

**Expected outcome:**
- AssumeCommandConfirmCard closes.
- Incident Identity Bar updates: commander field now shows "Alex".
- Duration counter continues running.
- Tab 2 label (Shift Notes): shows ✎ icon indicating pre-populated notes are present.
- [Assume Command] button is replaced by [Relinquish Command] or disappears.

---

### Step 2.6 — Alex Opens Tab 2 (Shift Notes)

**Alex clicks Tab 2 (Shift Notes) in the IC surface tab bar.**

**Expected outcome:**
- Textarea content: "PRE dropped to L3 during the 19:00 fixture. Content recovery in progress."
  - Note: these notes carry over from incident-001's established context, or they are pre-seeded for incident-002 to provide narrative continuity in the demo.
- Textarea is editable — Alex can type additional notes.
- [Clear] button is visible in the bottom-right of the Shift Notes pane.
- Character count or timestamp of last update may be visible.

**Demo note for operator:** Type one additional note line to demonstrate editability: "S2 escalated at [current time]. Assumed command — monitoring content delivery." Then proceed to Act 3.

---

## 4. Demo Act 3 — L6 Override Placement (5 minutes)

**Scene:** Alex places an emergency L6 override on The Crown & Anchor, then removes it.

**Purpose for stakeholders:** Show that emergency override actions require deliberate multi-step confirmation — accidental triggers are structurally impossible.

---

### Step 3.1 — Alex Opens Tab 3 (Override Inventory)

**Alex clicks Tab 3 (Override Inventory) in the IC surface tab bar.**

**Expected outcome:**
- Override list is empty.
- Empty state message visible: "No active overrides for this venue."
- Tab 3 label has no red dot badge (PATCH-010) — badge only appears when overrides are active.
- [Place Override +] button is visible in the Tab 3 pane or in the IC Zone B header.

---

### Step 3.2 — Alex Clicks [Place Override +]

**Alex clicks [Place Override +].**

**Expected outcome:**
- L6OverridePlacementFlow renders (modal or inline Zone B panel).
- Step 1 chip-select is visible and active: "I confirm this override is necessary"
- Step 2 chip: visible but locked (grayed, not clickable).
- Step 3 chip: visible but locked (grayed, not clickable).
- [Place L6 Override] button: absent from DOM (not rendered until Step 3 is confirmed).
- No progress is possible until Step 1 is clicked.

---

### Step 3.3 — Alex Clicks Step 1 Chip

**Alex clicks the Step 1 chip: "I confirm this override is necessary"**

**Expected outcome:**
- Step 1 chip transitions to confirmed state (filled/checkmark visual).
- Step 2 chip unlocks and becomes clickable: "I confirm this affects venue-wide content delivery"
- Step 3 chip remains locked (grayed, not clickable).
- [Place L6 Override] button remains absent from DOM.

**Talking point (engineering):** "PATCH-001 SequentialChipSelect — each confirmation unlocks the next. This is not a checkbox list — completing Step 1 is a prerequisite for Step 2 to become interactive. The DOM enforces the sequence."

---

### Step 3.4 — Alex Clicks Step 2 Chip

**Alex clicks the Step 2 chip: "I confirm this affects venue-wide content delivery"**

**Expected outcome:**
- Step 2 chip transitions to confirmed state.
- Step 3 chip unlocks and becomes clickable: "I confirm this action cannot be undone without a separate removal action"
- [Place L6 Override] button renders below Step 3 — but is visually indicated as requiring Step 3 before activation (or is absent from DOM until Step 3 completes — implementation determines which).

---

### Step 3.5 — Alex Clicks Step 3, Then [Place L6 Override]

**Alex clicks the Step 3 chip, then clicks [Place L6 Override].**

**Expected outcome after Step 3 click:**
- Step 3 chip transitions to confirmed state.
- [Place L6 Override] button is fully active (or appears in DOM if previously absent).

**Expected outcome after [Place L6 Override] click:**
- L6OverridePlacementFlow closes.
- Tab 3 Override Inventory updates immediately: new entry visible:
  - "L6 EMERGENCY — placed by Alex — [current timestamp]"
  - Entry shows venue: "The Crown & Anchor", operator: "Alex", timestamp: server-authoritative.
- Tab 3 label in the tab bar: red dot badge appears (PATCH-010).
- Zone B Intervention Surface: active L6 indicator visible (may be a banner or status chip).
- Zone C may update to reflect active override.

**Talking point (stakeholders):** "Three separate confirmation steps — no accidental emergency overrides. An operator under pressure still has to consciously confirm each step. This is a safety property, not a UX inconvenience."

---

### Step 3.6 — Alex Clicks Override Entry, Then [Remove Override]

**Alex clicks the L6 override entry in Tab 3. A detail panel or inline action row expands.**

**Alex clicks [Remove Override].**

**Expected outcome:**
- HoldToConfirmButton renders (PATCH-002).
- Label: "Hold to remove override"
- Progress arc (circular or linear) is visible but empty.
- Button is styled to indicate a hold action is required — not a tap.

---

### Step 3.7 — Alex Holds [Remove Override] for 3 Seconds

**Alex presses and holds the [Remove Override] button for the full 3-second duration.**

**Expected outcome during hold:**
- Progress arc fills continuously from 0% to 100% over 3 seconds.
- If Alex releases before 3 seconds: progress resets to 0%, override is NOT removed, no error shown.

**Expected outcome at 3 seconds:**
- Override is removed.
- Tab 3 red dot badge clears (PATCH-010).
- Override entry disappears from the list.
- Empty state message returns: "No active overrides for this venue."
- Zone B Intervention Surface: L6 indicator disappears.

**Talking point (stakeholders):** "Three-second hold — requires deliberate, sustained action. You can't accidentally remove an emergency override. If you let go before three seconds, nothing happens."

**Talking point (operations):** "Override removal is a separate action from placement — by constitutional design. You cannot place and remove in one motion. The audit trail shows both events independently."

---

## 5. Demo Act 4 — Concurrent Conflict (3 minutes)

**Requires:** Browser 1 (Alex) + Browser 2 (Jordan) simultaneously open

**Scene:** Both Alex and Jordan attempt to claim incident command at the same time. One succeeds; the other receives a rejection with a precise conflict message.

**Purpose for stakeholders:** Show that the system prevents two operators from both thinking they are in command — and that the losing operator is immediately informed.

---

### Step 4.1 — Setup: Reset Commander on incident-002

**Before starting Act 4, reset the commander field on incident-002:**

```bash
DELETE /incidents/incident-002/commander
# Admin endpoint — requires ADMIN token
```

**Expected outcome:**
- Incident Identity Bar in both browsers: commander = "No commander assigned"
- [Assume Command] button visible in both browsers.

---

### Step 4.2 — Jordan Joins in Browser 2

**Jordan opens Browser 2, logs in as OPERATOR "Jordan", navigates to the IC surface for incident-002.**

**Expected outcome:**
- Jordan's Zone B: IC surface for incident-002.
- Commander: "No commander assigned" (same view as Alex).
- Both operators are now viewing the same incident simultaneously.

---

### Step 4.3 — Simultaneous [Assume Command] Click

**Alex (Browser 1) and Jordan (Browser 2) both click [Assume Command] at approximately the same time.**

**Expected outcome — one browser wins (assume Alex wins):**

**Browser 1 (Alex):**
- AssumeCommandConfirmCard opens briefly, or Alex's claim is processed first.
- Incident Identity Bar: commander = "Alex"
- No error — Alex's claim succeeded.

**Browser 2 (Jordan):**
- Rejection toast appears: "Action not applied — conflict detected: Commander was claimed by Alex 0s ago."
- Toast is visible for approximately 4 seconds, then fades.
- Jordan's Incident Identity Bar also updates to show "Alex" as commander (within 2 seconds of the server-side update).
- [Assume Command] button is replaced with [Relinquish Command] button (greyed out — Jordan is not the commander).

**Talking point (stakeholders):** "The system prevents split-brain command — two operators can't both believe they are in charge. One wins, the other is told immediately. No guessing, no confusion about who is responsible."

**Talking point (engineering):** "Commander claims use optimistic locking with a version field. The first write wins; the second receives a CONCURRENCY_CONFLICT rejection. The toast uses the standard rejection envelope — every write failure produces a visible operator response. There are no silent failures."

---

## 6. Demo Act 5 — CMS Content Management (5 minutes)

**Scene:** Alex switches to CMS to review content delivery for the weekend fixtures, including a HIGH_PRIORITY slot warning.

**Purpose for stakeholders:** Show that the system manages content scheduling with priority-aware warnings and that operators can create new content slots.

---

### Step 5.1 — Navigate to CMS Surface

**Alex clicks "CMS" in Zone A OperatorTools, or navigates to `/ops/cms`.**

**Expected outcome:**
- CMS surface renders in Zone B.
- Tab bar visible: Tab 1 (Asset Library), Tab 2 (Content Calendar), Tab 3 (Delivery Queue), Tab 4 (Corpus Status), Tab 5 (Delivery Confidence).
- Tab 2 (Content Calendar) is active by default.
- Calendar defaults to The Crown & Anchor (last selected venue), week view.

---

### Step 5.2 — View HIGH_PRIORITY Saturday Slot (venue-001)

**Alex views the calendar for venue-001 (The Crown & Anchor). Saturday 20:00–22:00 slot is visible.**

**Expected outcome:**
- Slot label: "★ Premier League Highlights — Match Day 38"
  - ★ prefix indicates HIGH_PRIORITY delivery priority.
- Slot is sorted above the Sunday 14:00 ROUTINE entry in the same venue column.
- ROUTINE slot "Sunday Sports Roundup" has no ★ prefix.
- Saturday 20:00 slot for venue-002 (Pitch Side Bar) is visually distinct as empty/unscheduled.

---

### Step 5.3 — Click the ★ Slot to Open Delivery Details

**Alex clicks the "★ Premier League Highlights — Match Day 38" slot.**

**Expected outcome:**
- Slot detail panel opens (Zone C or inline Zone B panel).
- DeliveryWarningBanner renders in HIGH_PRIORITY variant:
  - Header: "★ HIGH PRIORITY — 72h deadline: [Saturday 20:00]"
  - Border: deep-orange `#E64A19`
  - Background: `#FBE9E7` (deep-orange tint)
  - Second line: "Event: Premier League Highlights — Match Day 38 · Declared by: Sarah K."
- Delivery status: SCHEDULED (within window) or WARNING if the 72h threshold is approaching.

**Talking point (stakeholders):** "The star and deep-orange color mean this event is high priority — it was flagged by Sarah when she scheduled it. The system is tracking the 72-hour delivery deadline and will start warning earlier than it would for a routine slot."

---

### Step 5.4 — View Tab 5 (Delivery Confidence)

**Alex clicks Tab 5 (Delivery Confidence) in the CMS tab bar.**

**Expected outcome:**
- HIGH_PRIORITY countdown for Saturday 20:00 slot is displayed.
- In this demo context the slot is more than 48 hours away — countdown color: amber (HIGH_PRIORITY warning starts at 48h remaining, vs standard slots which warn only on the day).
- ROUTINE slot "Sunday Sports Roundup" has a separate entry — green (well within window).
- Venue-002 (Pitch Side Bar) shows no delivery confidence entry for Saturday (no content scheduled).

**Talking point (stakeholders):** "High priority content starts warning earlier — amber at 48 hours instead of the usual deadline-day warning. Important fixtures get more lead time to catch delivery problems."

**Talking point (engineering):** "HIGH_PRIORITY threshold is a constitutional constant — 48h for HIGH_PRIORITY, 24h for ROUTINE. The threshold is checked server-side; the client receives a computed warning_level field. The client never applies business logic to determine urgency."

---

### Step 5.5 — Create a New Slot for venue-002 (Pitch Side Bar)

**Alex navigates back to Tab 2 (Content Calendar). Alex clicks the empty Saturday 20:00 slot for "Pitch Side Bar".**

**Expected outcome:**
- SlotCreateForm renders (modal or Zone C panel).
- Fields: title (text), start time (pre-filled: Saturday 20:00), end time, delivery_priority (dropdown — default: ROUTINE).
- "★ Mark as High Priority" checkbox is unchecked by default.
- Submit button: [Create Slot] — active when title is filled.

**Alex fills in the title:** "Saturday Night Football — League Cup"
**Alex checks:** "★ Mark as High Priority"

---

### Step 5.6 — Submit the HIGH_PRIORITY Slot

**Alex clicks [Create Slot] (or [Submit]).**

**Expected outcome (if 72h deadline would be tight — depends on demo timing):**
- DeliveryWarningBanner renders in HIGH_PRIORITY variant before submission is confirmed.
- Warning: "★ HIGH PRIORITY — this slot requires delivery confirmation within 72h of event start."
- Confirmation button: "⚠ Submit anyway" — Alex clicks it.

**Expected outcome after confirmation:**
- Slot appears in calendar for venue-002, Saturday 20:00–22:00:
  - Label: "★ Saturday Night Football — League Cup"
  - ★ prefix visible.
- Tab 5 Delivery Confidence: new entry for venue-002 Saturday slot (amber, HIGH_PRIORITY threshold).

**Talking point (operations):** "The 72-hour lead time is constitutionally enforced. Content cannot physically reach a remote venue player faster than this window. The system doesn't let you create a HIGH_PRIORITY slot that can't be delivered in time — it warns you before you commit."

---

## 7. Demo Act 6 — Zone C Advisory Escalation (2 minutes)

**Scene:** While Alex is on Live Ops for venue-001, a Zone C advisory escalates from INFORMATIONAL to URGENT in real time.

**Purpose for stakeholders:** Show that low-urgency updates are visible without demanding attention — and that escalations surface themselves with minimal disruption.

---

### Step 6.1 — Alex Returns to Live Ops for venue-001

**Alex navigates to Live Ops surface for venue-001 (The Crown & Anchor).**

**Expected outcome:**
- Zone C Pane C4 Advisory panel visible.
- Advisory text: "Minor PRE entropy on The Crown & Anchor — no action required."
- Advisory state: INFORMATIONAL — no border treatment, standard background color.
- NotificationTray in Zone A: no new badge (INFORMATIONAL advisories do not increment the badge).

---

### Step 6.2 — Live Advisory Escalation to URGENT

**[Demo operator action — run backend trigger script]**

```bash
# Escalate advisory_level for venue-001 to URGENT
POST /admin/demo/trigger/advisory?venue_id=venue-001&level=URGENT&message=PRE+entropy+elevated+on+The+Crown+%26+Anchor+%E2%80%94+intervention+may+be+required
```

**Expected outcome (within 2 seconds, no page refresh):**
- Zone C Pane C4: border changes to deep-orange `#E64A19`.
- Advisory card background: `#FBE9E7` (deep-orange tint).
- Advisory text updates to: "PRE entropy elevated on The Crown & Anchor — intervention may be required."
- A single 800ms opacity pulse fires on the Pane C4 card (0.4 opacity → 1.0 → stays at 1.0). Pulse fires once only — card is then static.
- Zone A NotificationTray badge increments by 1.

**Talking point (stakeholders):** "The advisory escalated — you can see it in the corner of the screen even without looking directly at it. One pulse to draw your attention, then it stays visible and static. The system doesn't flash continuously — that would be noise. One pulse, then it's up to you."

**Talking point (engineering):** "Advisory escalation is a separate WebSocket event type from venue state updates. The opacity pulse is a CSS animation that fires once and does not loop. The animation class is added on event receipt and removed after 800ms — no persistent animation state."

**Talking point (operations):** "Zone C advisories are below the threshold for automatic Zone B takeover. An S2 incident forces Zone B to IC surface; a Zone C advisory does not. Operators retain control of Zone B during URGENT advisories — they can choose to act or continue monitoring."

---

## 8. Demo Reset / Cleanup Instructions

Run these steps between demo runs to restore seed state:

### 8.1 Full Reset (before a fresh demo run)

```bash
# Step 1: Recreate all seed data (venues, incidents, content calendar)
npm run seed:demo

# Step 2: Confirm seed loaded correctly
GET /admin/demo/status
# Expected: { seeded: true, venues: 3, incidents: 1, contentSlots: 3 }
```

### 8.2 Partial Resets (between acts, without full reseed)

**Reset venue-003 to RECOVERED_BUT_UNTRUSTED (undo Act 1.6 trigger):**
```bash
POST /admin/demo/reset/venue?venue_id=venue-003&machine_state=RECOVERED_BUT_UNTRUSTED
```

**Clear commander from incident-002 (undo Act 2.5 and prepare Act 4):**
```bash
DELETE /incidents/incident-002/commander
# Requires ADMIN token
```

**Remove all overrides from incident-002 (undo Act 3.5):**
```bash
DELETE /incidents/incident-002/overrides
# Requires ADMIN token
```

**Reset advisory_level for venue-001 to INFORMATIONAL (undo Act 6.2 trigger):**
```bash
POST /admin/demo/trigger/advisory?venue_id=venue-001&level=INFORMATIONAL&message=Minor+PRE+entropy+on+The+Crown+%26+Anchor+%E2%80%94+no+action+required
```

**Clear venue-002 Saturday slot (undo Act 5.6):**
```bash
DELETE /cms/slots?venue_id=venue-002&date=saturday&time=20:00
# Or use CMS UI: click slot → [Delete Slot]
```

### 8.3 Verify Reset Complete

Before starting a new demo run, confirm in Browser 1:
- [ ] Zone A shows 3 venues: green, grey, ↻ orange
- [ ] Zone A IncidentList shows incident-001 (S3, no commander)
- [ ] Zone C advisory for venue-001: INFORMATIONAL (no deep-orange)
- [ ] CMS calendar: venue-002 Saturday slot is empty
- [ ] System Status Bar: all 6 indicators green

---

## 9. Talking Points by Audience

### 9.1 For Product Stakeholders (non-technical)

Deliver these at the moments indicated in the act descriptions. Also available as standalone statements:

- **Real-time updates:** "No page refreshes — everything updates live as venue state changes. The system pushes information to you; you don't have to go looking for it."

- **Automatic navigation:** "When an S2 emergency fires, the system brings operators to the right screen automatically. They don't navigate — they respond."

- **Three-step override confirmation:** "Emergency overrides require three separate confirmations — designed so operators can't accidentally take the wrong action under pressure. Each step is a deliberate choice."

- **Hold-to-remove:** "Removing an emergency override requires a three-second hold. You can't accidentally undo an emergency action. If you let go before three seconds, nothing happens."

- **Commander conflict protection:** "The system prevents two operators from both thinking they are in command. One wins, the other is told immediately — with the winner's name and when the claim happened."

- **HIGH_PRIORITY content warnings:** "High priority content gets earlier warnings so important fixtures never miss their delivery window. The system tracks the 72-hour lead time so operators don't have to."

- **Advisory pulse:** "A single pulse draws attention to an escalation — then it's static. No continuous flashing. The system respects that operators are monitoring multiple things simultaneously."

### 9.2 For Engineering

Deliver these to engineering audiences during or after the relevant acts:

- **Zone A dot — WebSocket push:** "Zone A state dots are driven by a WebSocket push channel — `venue_state_update` events. The server pushes changes; the client never polls. Dot color and animation state are pure React state derived from the incoming event."

- **Write rejection envelope:** "Write rejections use a standard rejection envelope — every write failure produces a visible operator response with the reason and conflict detail. There are no silent failures. CONCURRENCY_CONFLICT is one rejection type; the toast format is shared across all rejection types."

- **IC-03 — absent from DOM, not disabled:** "IC-03 applies in RECOVERED_BUT_UNTRUSTED state and in replay mode: write controls are absent from DOM, not disabled. A DOM inspector confirms there is no button element — not a disabled button. This is a structural safety property."

- **Server-authoritative timestamps:** "All timestamps shown to operators are server-authoritative. The client never calls Date.now() for anything the operator sees — durations, deadlines, and autonomy clocks are computed from server-provided reference timestamps and counted down locally with drift correction."

- **SequentialChipSelect (PATCH-001):** "L6 override placement uses sequential chip unlock — each confirmation is a DOM prerequisite for the next. Step 2 is not in the interactive state until Step 1 is confirmed. The sequence is enforced structurally, not by validation logic."

- **HoldToConfirmButton (PATCH-002):** "Hold-to-confirm uses a progress arc that resets on release. The removal action is only dispatched at the 3-second mark — a partially completed hold produces no server write. The arc fill is driven by a requestAnimationFrame loop, not a CSS timer."

- **HIGH_PRIORITY threshold is constitutional:** "The 48h HIGH_PRIORITY warning threshold is a server-side constitutional constant. The client receives a computed `warning_level` field from the API — it applies no business logic to determine urgency."

### 9.3 For Operations

Deliver these to operations audiences during or after the relevant acts:

- **COMMANDER_LAPSED escalation:** "The COMMANDER_LAPSED alert fires at 15 minutes with no commander assigned to an S1 or S2 incident. No incident can be left ungoverned — the system escalates automatically."

- **RECOVERED_BUT_UNTRUSTED protection:** "RECOVERED_BUT_UNTRUSTED prevents override placement until the venue's corpus hash is verified by the server. Operators cannot push emergency content to a venue whose on-site state is uncertain."

- **72h constitutional enforcement:** "The 72-hour content delivery lead time is constitutionally enforced. The system rejects or warns on HIGH_PRIORITY slots that cannot physically reach the venue player in time. Operators cannot accidentally schedule content that is too late to deliver."

- **Advisory vs. auto-redirect:** "Zone C URGENT advisories are visible and attention-drawing — one pulse, deep-orange border. They do not force Zone B to the IC surface. Only S1 and S2 incidents trigger Zone B auto-replace. Operators retain Zone B control during advisories."

- **Autonomy clock:** "The autonomy clock shows exactly how long an offline venue can continue serving its local corpus. Amber above 6 hours, red below. Operations has a clear time window to restore connectivity before content expires."

- **No silent rejections:** "Every operator write action that fails produces a visible toast with the reason. This applies to commander claims, override placements, slot submissions, and all other state changes. If something doesn't happen, the operator is told why."

---

## 10. Demo Timing Reference

| Act | Duration | Key risk |
|---|---|---|
| 1 — Venue Health Monitoring | 5 min | Step 1.6 backend trigger must fire cleanly; rehearse timing |
| 2 — Incident Response | 8 min | Step 2.1 trigger must fire while Alex is on venue-003; coordinate with demo operator |
| 3 — L6 Override | 5 min | Step 3.7 hold requires steady mouse/finger — demonstrate clearly |
| 4 — Concurrent Conflict | 3 min | Requires coordination between Browser 1 and Browser 2 operators; rehearse timing |
| 5 — CMS Content | 5 min | Step 5.6 confirmation banner depends on demo timing relative to Saturday date |
| 6 — Zone C Advisory | 2 min | Step 6.2 trigger must fire while Alex is on Live Ops view |
| **Total** | **~28 min** | Add 5 min buffer for audience questions between acts |

---

## 11. Known Demo Risks and Mitigations

**Risk:** Backend trigger scripts fail during live demo.
**Mitigation:** Pre-record a 30-second video of each trigger and its outcome. Play video if the live trigger fails. Note: Acts 1.6, 2.1, and 6.2 depend on triggers.

**Risk:** Concurrent conflict (Act 4) timing is off — one operator clicks too early.
**Mitigation:** Use a countdown in a shared chat or a hand signal. The conflict only works if both clicks are within approximately 500ms of each other. Rehearse this act before the demo.

**Risk:** Stakeholder asks about Replay Investigation (Tab 4, IC surface).
**Response:** "Replay Investigation is deferred in the MVP — Tab 4 is present in the tab bar but marked 'Coming soon.' It's on the roadmap for Wave 2. Everything you've seen today is in the MVP scope."

**Risk:** Stakeholder asks about Training Mode in CMS.
**Response:** "Training Mode is in the CMS design but deferred in MVP scope — the toggle won't appear in this build. It's a Wave 2 feature."

**Risk:** Demo host is asked to show an admin view.
**Response:** "Alex is an OPERATOR role — that's the most common role in the field. ADMIN surfaces exist but aren't part of this demo. The permission boundaries you're seeing are intentional."

---

*This document is the authoritative demo script for MVP Slices 0–6 (partial 8). Updates to this script require updating expected outcomes for all affected steps. A step with an expected outcome that does not match implementation is a bug in the implementation, not the script.*
