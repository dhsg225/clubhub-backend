# CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2

**Document type:** Canonical reference surface specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Designers, frontend engineers, CMS contributors
**Depends on:** OPERATIONAL-WORKSPACES-v1.md, SPONSORSHIP-OPERATIONS-UX-v1.md,
               TEMPLATE-AND-PRESET-GOVERNANCE-v1.md, FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md,
               APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md
**Version:** 2.0
**Status:** CANONICAL

---

## 1. Surface Identity

### 1.1 What This Surface Is

The CMS Content Operations Surface is the planned-work workspace for ClubHub TV. Operators use it to author schedules, manage content, govern templates, configure sponsor slots, and track corpus delivery to venues. It is a content authoring environment, not a live operations environment. Decisions made here take effect through the corpus delivery pipeline — not immediately on screens.

**This surface is:**
- A tool for composing, approving, and delivering content before it plays
- A governance surface for templates, sponsor contracts, and scheduled slots
- A delivery visibility surface for tracking corpus status per venue
- A historical audit trail for all content decisions

**This surface is not:**
- A live override tool (overrides go through the Incident Commander or Live Operations surfaces)
- A real-time operations surface (content authored here does not affect live venue state immediately)
- An emergency response tool (emergency content activation is performed in the Emergency Operations surface)

### 1.2 Canonical Routes

| URL | Tab opened |
|---|---|
| `/cms` | Restores last active tab from localStorage; defaults to `/cms/schedule` |
| `/cms/library` | Content Library (Tab 1) |
| `/cms/schedule` | Schedule Builder (Tab 2) |
| `/cms/templates` | Template Management (Tab 3) |
| `/cms/sponsorship` | Sponsor Management (Tab 4) |
| `/cms/delivery` | Delivery Status (Tab 5) |
| `/cms/history` | Content History / Audit (Tab 6) |

All CMS tab switches push browser history entries. Deep-linking to any `/cms/*` route opens the correct tab directly.

### 1.3 Role Access Matrix

| Role | Access level | Tab restrictions |
|---|---|---|
| Platform Admin | Full access | None |
| Network Admin | Full access | None |
| League Admin | Full access within league scope | Cannot manage Platform/Network-tier content |
| Venue Admin | Full access within venue scope | Cannot manage League/Network/Platform-tier content |
| Content Creator | Author + submit for approval | Cannot approve own content; cannot manage templates |
| Viewer | Read-only | All tabs visible, no write actions |

### 1.4 The 72-Hour Delivery Lead Time — Surface-Wide Requirement

Content changes must be delivered to the venue corpus before they play. The minimum delivery lead time is 72 hours. This constraint is constitutional — it cannot be configured away or bypassed.

**Where the 72-hour rule appears on this surface:**
- **Tab 2 (Schedule Builder):** Warning indicator on every slot scheduled within 72 hours of play time. Hard block on submission if any slot is within 24 hours of play time without manual delivery confirmation.
- **Tab 5 (Delivery Status):** Per-venue, per-item 72-hour countdown for all pending scheduled items.
- **Zone C (Preview Panel):** Confidence indicator for scheduled delivery shows whether the 72-hour window is safe, at risk, or critical.
- **Tab 2, Schedule Header:** A persistent banner shows the current time and the earliest safe scheduling boundary ("Safe to schedule content for play after [timestamp 72h from now]").

---

## 2. Zone A — Navigation for CMS

Zone A is the persistent left navigation panel. Its content is independent of the active Zone B tab. It does not refresh or re-render when the operator switches tabs.

### 2.1 Zone A Elements During CMS

**System Status Bar (top of Zone A):**
- Constitutional state indicator: circle dot (green/amber/red/grey) + label ("HEALTHY", "DEGRADED", "EMERGENCY_FREEZE", etc.)
- If `EMERGENCY_FREEZE`: label turns red; CMS tab navigation items are visually disabled with tooltip "Content authoring unavailable during Emergency Freeze"
- If `DEGRADED`: amber indicator; CMS authoring continues but delivery may be affected

**Venue Selector (Pane A1):**
- Dropdown or scrollable list of venues the operator is assigned to
- Selected venue determines the scope for Schedule Builder, Delivery Status, and Content History
- Viewer: only assigned venues. Operator and above: all venues with assignment badges

**Active Incident Banner (Pane A2 — conditional):**
- If any S1 or S2 incident is active for the currently scoped venue, a persistent amber or red strip appears at the top of Zone A with text: "INCIDENT ACTIVE — [INCIDENT_ID] — [severity badge]"
- Clicking the banner navigates to the Incident Commander surface; it does not close the incident
- The banner does not block CMS navigation; it persists alongside normal authoring

**CMS Navigation Items:**
Listed vertically below the venue selector. Each item is a link to the corresponding CMS tab.

| Nav item label | Route | Minimum role to see | Minimum role to use |
|---|---|---|---|
| Content Library | `/cms/library` | Viewer | Viewer (read-only), Content Creator (upload) |
| Schedule Builder | `/cms/schedule` | Viewer | Content Creator |
| Templates | `/cms/templates` | Viewer | League Admin (create), Content Creator (apply) |
| Sponsor Management | `/cms/sponsorship` | Viewer | Venue Admin |
| Delivery Status | `/cms/delivery` | Viewer | Viewer |
| Content History | `/cms/history` | Viewer | Viewer |

Role-based visibility: The nav item is always visible to Viewers for read-only orientation. Write actions within each tab are gated individually.

**Notification Tray (Pane A3):**
- Badge count for unread notifications (delivery failures, approval actions, sponsor alerts)
- Clicking opens a tray overlay over Zone A; does not change Zone B

**Operator Tools (Pane A4):**
- Training mode toggle (see Section 8)
- Session info: operator name, role, current venue scope
- Logout

---

## 3. Zone B — Tab System

### Tab 1: Content Library

**Route:** `/cms/library`
**Minimum role to view:** Viewer
**Minimum role to upload:** Content Creator

#### 3.1.1 Content Item Anatomy

Each item in the library is displayed as a card (grid view) or a row (list view, toggled via view toggle control in the tab header).

**Card view fields:**
```
┌───────────────────────────────────┐
│ [THUMBNAIL — 16:9 aspect ratio]   │
│                                   │
│ [CONTENT TITLE]          [STATUS] │
│ Type: [Video / Image / Loop]      │
│ Duration: [mm:ss]                 │
│ Tier: [Platform/Network/League/   │
│        Venue]                     │
│ Governance: [APPROVED / PENDING / │
│              DRAFT / ARCHIVED]    │
│ In use: [Scheduled on N slots]    │
│ or: [Not scheduled]               │
└───────────────────────────────────┘
```

**List view additional columns:**
- Uploaded by
- Upload date
- Last modified
- Delivery status (DELIVERED / PENDING / FAILED / STALE — see Tab 5)
- Actions column (Edit, Archive, Preview)

#### 3.1.2 Content Item States

| State | Badge color | Meaning |
|---|---|---|
| DRAFT | Grey | Created but not submitted for approval |
| PENDING_APPROVAL | Amber | Submitted; awaiting reviewer action |
| APPROVED | Blue | Approved; eligible to be scheduled |
| LIVE | Green | Approved and currently on at least one active schedule slot |
| ARCHIVED | Strikethrough, muted | Removed from scheduling; preserved in history |

Archived items appear in a collapsed "Archived" section at the bottom of the library, hidden by default. Toggle "Show archived" to expand.

#### 3.1.3 Filter Controls (Tab Header Bar)

All filters are additive (AND logic). Reset button clears all filters.

- **Type:** Video | Image | Loop | All
- **Tier:** Platform | Network | League | Venue | All
- **Governance status:** Draft | Pending Approval | Approved | Live | Archived | All
- **Delivery status:** Delivered | Pending | Failed | Stale | All
- **In use:** Scheduled | Unscheduled | All
- **Search:** Free text search on title (debounced, 300ms)

Filter state is not persisted in the URL (query-parameter state only, lost on refresh).

#### 3.1.4 Upload New Content Flow

Triggered by: "Upload content" button (top right of tab header). Visible to Content Creator and above; absent from DOM for Viewer.

**Upload form fields:**
1. **Title** (required, max 120 characters)
2. **Content type** — dropdown: Video | Image | Loop
3. **File upload** — drag-and-drop or file picker. Accepted: MP4, MOV (video); PNG, JPG, GIF (image). Max file size: 500 MB. Progress bar shown during upload.
4. **Duration** (auto-populated from file metadata; editable for image/loop)
5. **Tier assignment** — dropdown restricted to tiers at or below the operator's tier authority. A Venue Admin cannot assign Platform tier.
6. **Description** (optional, max 500 characters)
7. **Tags** (optional, free text, comma-separated)

**Validation before submit:**
- Title is required
- File upload completed successfully
- Tier assignment is within operator's authority (enforced server-side; also blocked in UI dropdown)
- Duration is non-zero

**On submit:** Content enters DRAFT state. A "Submit for approval" button appears on the newly created item card. Upload confirmation toast: "Content '[TITLE]' uploaded successfully. Status: DRAFT."

#### 3.1.5 Content In Use Indicator

If a content item is on one or more active schedule slots, its card shows: "Scheduled on [N] slot(s)." Clicking this opens a slide-over panel listing the schedule slots using this content: slot name, venue, time range, approval status. From this panel the operator can navigate directly to the slot in Schedule Builder.

If a content item is archived while it is still on a scheduled slot, a warning modal blocks the archive action: "This content is referenced by [N] active schedule slot(s). Archive anyway? Slots referencing archived content will move to CONFLICT status and require reassignment."

---

### Tab 2: Schedule Builder

**Route:** `/cms/schedule`
**Minimum role to view:** Viewer
**Minimum role to create/edit:** Content Creator
**Minimum role to approve:** Venue Admin (for venue-scope slots), League Admin (for league-scope)

#### 3.2.1 Schedule Canvas

**Default view:** Timeline view (horizontal time axis). Toggle to list view via "Switch to list view" button in tab header.

**Timeline view anatomy:**
- Horizontal axis: time of day (00:00–23:59), selectable date via date picker
- Vertical axis: one row per venue in scope, or one row per content zone (designer's choice — scope selector in header)
- Slots displayed as colored horizontal bars spanning their time range
- Slot color indicates approval status: grey (DRAFT), amber (PENDING_APPROVAL), blue (APPROVED), green (LIVE)
- Overlapping slots display as stacked bars with a red outline (conflict state)

**72-hour delivery boundary line:**
A vertical dashed red line on the timeline marks "72 hours from now." Slot bars that cross this line display a warning treatment (amber diagonal stripe). Slot bars entirely to the left of this line (within 72 hours) display a critical treatment (solid red outline). See Section 6 for full specification.

**Safe scheduling banner (above timeline):**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ⏱ 72-hour delivery window: Content scheduled for play after          │
│   [DAY, DATE, HH:MM TIMEZONE] is within the safe delivery window.   │
│   Content scheduled to play before this time requires verified       │
│   pre-delivery or may not reach venues in time.                      │
└──────────────────────────────────────────────────────────────────────┘
```
This banner is static and always visible at the top of Tab 2. It is not dismissible.

#### 3.2.2 Schedule Slot Anatomy

Each slot in the timeline or list view exposes the following fields:

| Field | Display |
|---|---|
| Slot name | Editable label (max 80 characters) |
| Time range | Start time → End time in venue local timezone (e.g., "18:00 → 22:00 AEST") |
| Content reference | Linked content item title (click to open in Content Library) |
| Tier | The governance tier of this slot (Platform / Network / League / Venue) |
| Override level | If this slot is a sponsor injection: "L4 — Sponsor" label in amber |
| Approval status | DRAFT / PENDING_APPROVAL / APPROVED / LIVE |
| Venue assignment | Venue name(s) this slot is assigned to |
| Created by | Operator name + governed timestamp |
| 72h warning | Conditional — see Section 6 |

#### 3.2.3 Adding Content to a Schedule

**Method 1 — Drag-and-drop (timeline view):**
Drag a content item from the Content Library sidebar (collapsible panel on the right side of Tab 2) onto the timeline canvas. Drop position sets the start time; the slot duration auto-populates from content duration. Resize handles on both ends of the slot bar adjust start/end times.

**Method 2 — Form entry ("+ Add slot" button):**
Opens a slide-over form with fields:
1. **Slot name** (required)
2. **Content item** — searchable dropdown showing APPROVED content only. DRAFT content is excluded. Note beneath dropdown: "Only approved content may be scheduled."
3. **Start time** — date + time picker in venue local timezone
4. **End time** — date + time picker (or duration field that auto-computes end time)
5. **Venue assignment** — multi-select of venues the operator has scope over
6. **Override level** — if sponsor content: dropdown limited to L4 maximum. See Section 7.
7. **Repeat** — None | Daily | Weekly | Custom

**On save:** Slot enters DRAFT state. "Submit for approval" action becomes available.

#### 3.2.4 Conflict Detection (Inline)

Conflict conditions are detected client-side on drop/form-save and confirmed server-side on submission.

| Conflict type | Inline display | Blocking? |
|---|---|---|
| Overlapping time range with existing slot | Red outline on both overlapping slots; tooltip "Overlaps with [SLOT_NAME] [HH:MM–HH:MM]" | Soft warning; can save as DRAFT |
| Tier violation (slot tier above operator's authority) | Error badge on tier field: "Your authority is [TIER]. Select [TIER] or below." | Hard block; cannot save |
| Content item in DRAFT or ARCHIVED state | Error badge on content field: "Only APPROVED content may be scheduled." | Hard block |
| Sponsor slot at L5 or higher | Error — see Section 7 | Hard block |

Conflicts surface inline on the slot form, not as a modal blocking the entire canvas. The operator sees the conflict and can correct it without losing their work.

#### 3.2.5 72-Hour Delivery Warning in Schedule Builder

See Section 6 for complete specification. Summary of slot-level treatments:
- **>72 hours from play:** No warning. Slot displays normally.
- **<72 hours from play:** Amber diagonal stripe on slot bar. Warning badge on slot form: "⚠ This slot is within the 72-hour delivery window. Confirm delivery is complete before submission."
- **<24 hours from play:** Red outline on slot bar. Submission blocked. Error on slot form: "✗ Cannot submit. This slot starts in less than 24 hours. Manually verify delivery or adjust the start time."

#### 3.2.6 Approval Workflow

**Submit for approval:**
- Button label: "Submit for approval"
- Available on: DRAFT slots only
- Required role: Content Creator (submit), Venue Admin (approve)
- Clicking opens a confirmation dialog: "Submit '[SLOT_NAME]' for review? This slot covers [START]–[END] at [VENUE]. Once submitted, editing is locked until the reviewer acts."
- On confirm: slot state → PENDING_APPROVAL. Editing controls become disabled (read-only view of all fields). A "Withdraw submission" button appears, available to the submitter only.

**Reviewer assignment:**
The submitter may optionally assign a specific reviewer from a dropdown of operators with approve authority at the slot's scope. If unassigned, any qualifying reviewer may approve.

**Approval state indicator on slot:**
- PENDING_APPROVAL: amber lock icon on slot bar. Tooltip: "Awaiting approval — submitted [RELATIVE_TIME] by [OPERATOR]"
- APPROVED: blue checkmark icon
- REJECTED: red X icon. The slot reverts to DRAFT with a rejection note displayed beneath the slot header.

**Approval action panel (visible to approvers only):**
When a reviewer opens a PENDING_APPROVAL slot, two buttons appear in the slot's detail panel:
- "Approve" (primary action, blue)
- "Reject" — opens a text field requiring a rejection note before confirming

**LIVE state transition:**
Slots transition to LIVE automatically when the corpus delivery confirms the slot is active at the target venue(s). This transition is not triggered by the approver — it is a system state derived from delivery confirmation.

#### 3.2.7 Sponsor Slot Governance — L4 Ceiling

Sponsor slots entered in Schedule Builder (override level field set to "Sponsor — L4") are capped at L4. The override level dropdown for sponsor slots shows:

```
Override level:
  ○ L4 — Sponsor (constitutional maximum)
  ○ No override (standard scheduling)
```

L5 and L6 options are absent from the dropdown for sponsor slots. If an API response or data migration somehow delivers a sponsor slot at L5+, the Schedule Builder renders the slot with an error state:

```
⚠ Governance violation detected
This sponsor slot is configured at L[N] — above the constitutional L4 ceiling for sponsor content.
Sponsor content may not exceed L4. This slot cannot be approved until the override level is corrected.
```

The "Submit for approval" button is absent for slots in governance violation state.

---

### Tab 3: Template Management

**Route:** `/cms/templates`
**Minimum role to view:** Viewer
**Minimum role to create/edit:** League Admin (league-scope templates), Venue Admin (venue-scope)
**Minimum role to apply templates:** Content Creator

#### 3.3.1 Template List

Displayed as a sortable table with the following columns:

| Column | Description |
|---|---|
| Template name | Editable label |
| Type | T-01 Scheduling / T-02 Sponsorship / T-03 Emergency / T-04 Onboarding / T-05 Event / T-06 Layout / T-07 Escalation |
| Tier | Platform / Network / League / Venue |
| Governance level | The override tier this template applies |
| Last modified | Governed timestamp + operator name |
| Usage count | Number of venues/slots currently using this template |
| Review status | CURRENT / REVIEW_RECOMMENDED / REVIEW_REQUIRED |
| Confidence | Multi-signal confidence indicator (see Section 3.3.4) |
| Actions | Preview / Edit / Duplicate / Archive |

Sort controls: click column header. Default sort: Last modified, descending.

Filter controls: Type | Tier | Review status | Active / Archived

#### 3.3.2 Template Anatomy

Clicking a template name opens a slide-over detail panel:

**Header:**
- Template name (editable by authorized operators)
- Type badge + Tier badge
- Review status badge + next review date
- Confidence indicator (see 3.3.4)

**Slot Definitions section:**
Lists all slots this template creates when applied. Each slot entry shows: content rule, time range, override level, tier constraint. Content rules use placeholder tokens (e.g., `{sponsor_content}`, `{event_content}`) that are filled at application time.

**Content Rules section:**
Constraints governing what content can occupy each slot. Example: "Slot A requires APPROVED content of type Video, duration ≤ 60s, tagged 'sponsor'."

**Tier Constraints section:**
The minimum and maximum tiers this template operates within. "This template governs content at League tier and below. Venue Admins may apply this template. Network Admins may not be constrained by it."

**Lineage section:**
- Origin: Created from scratch / Derived from [parent template]
- Author + governed timestamp
- Modification history (collapsible, most recent first): each entry shows what changed, who changed it, when, and the operator's annotation

**Deployment history section:**
List of venues and dates where this template has been applied. Each entry is a link to the replay record for that application.

#### 3.3.3 Create Template Flow

Triggered by: "Create template" button (top right of tab header). Available to League Admin and above.

**Create template form:**

1. **Template name** (required, max 120 characters)
2. **Type** — dropdown: Scheduling / Sponsorship / Emergency / Onboarding / Event / Layout / Escalation
3. **Tier** — dropdown restricted to the operator's tier authority or below. A Venue Admin cannot create a Network-tier template. Error message if exceeded: "Your authority is [TIER]. You cannot create templates above [TIER]."
4. **Governance level** — the override level this template will apply when used. For sponsorship templates: capped at L4 (L5/L6 absent from dropdown).
5. **Description** (required, min 50 characters): what operational context is this template for? This field enforces minimum documentation.
6. **Context specificity** (required): which venue types is this template validated for? Multi-select: Golf Club / Licensed Club / Hotel / Sports Bar / Other.
7. **Slot definitions** — slot builder (repeatable section): for each slot, define content rule, time range, tier constraint.
8. **Review cycle** — dropdown: 30 days / 60 days / 90 days / 180 days (pre-populated based on type, editable)

**Validation before save:**
- Template name is required
- Description meets 50-character minimum
- Context specificity has at least one selection
- Governance level is within operator's authority
- At least one slot definition is provided

**On save:** Template created with review date set to today + review cycle. Template enters the list with CURRENT review status.

#### 3.3.4 Template Confidence Indicator

Each template displays a multi-signal confidence summary (not a single score):

```
Confidence:
  Review recency:    ✓ Reviewed 12 days ago
  Applications:      ✓ Applied 8 times, 0 incidents
  Assumption stability: ⚡ Contains conditional assumptions (contract terms)
  Blast radius:      ⚠ Venue-wide (elevated review required)
  PRE match rate:    ✓ 98% match across prior applications
```

Overall confidence badge: HIGH / MEDIUM / LOW / UNVERIFIED. Derived from the worst signal in the set.

#### 3.3.5 Template Inheritance

Child templates display a "Derived from: [PARENT_TEMPLATE_NAME]" badge. Clicking the badge opens a side-by-side comparison: parent configuration on the left, child configuration on the right. Fields that differ from the parent are highlighted in amber with an annotation column showing "Changed [RELATIVE_TIME] by [OPERATOR]: [annotation]."

If the parent template has been updated since derivation, a banner appears:
"Parent template updated [RELATIVE_TIME]. [N] field(s) in the parent have changed since this template was derived. [Review differences]"

#### 3.3.6 Template Authority Boundary

An operator cannot create or edit a template at a tier above their authority. This is enforced:
- In the create form: tier dropdown excludes options above the operator's tier
- In the edit panel: fields governing tier and governance level are read-only for operators below the template's tier
- Server-side: template save requests with out-of-authority tiers are rejected with error code `TEMPLATE_TIER_VIOLATION`

---

### Tab 4: Sponsor Management

**Route:** `/cms/sponsorship`
**Minimum role to view:** Viewer
**Minimum role to manage:** Venue Admin
**Minimum role to approve sponsor slots:** Venue Admin

#### 3.4.1 Sponsor Item List

Table columns:

| Column | Description |
|---|---|
| Sponsor name | Company or brand name |
| Campaign name | Campaign label within this sponsor relationship |
| Assigned tier | Always displayed as "L4 (max)" — never shows L5 or L6 |
| Contract start | Governed date |
| Contract end | Governed date |
| SOV contracted | Target share-of-voice percentage |
| SOV configured | Projected SOV from current configuration |
| SOV delivered | Rolling 7-day confirmed delivery |
| Delivery status | Per-venue summary (delivered / pending / at-risk) |
| Actions | View / Edit / Deactivate / Proof of Play |

Sort: clicking column header. Default: Contract end, ascending (soonest expiring first).

**L4 Ceiling Label (Tab 4 Header, always visible):**
```
┌────────────────────────────────────────────────────────────────┐
│ CONSTITUTIONAL CONSTRAINT — Sponsor content is capped at L4   │
│ override level. This ceiling is fixed and cannot be           │
│ configured. Sponsor content will be suppressed by any active  │
│ L1–L3 override on the targeted screens.                       │
└────────────────────────────────────────────────────────────────┘
```
This banner appears at the top of Tab 4 on every load. It is not dismissible.

#### 3.4.2 Add Sponsor Content

Triggered by: "Add sponsor" button (top right of tab header). Available to Venue Admin and above.

**Sponsor form fields:**

1. **Sponsor name** (required, max 120 characters)
2. **Campaign name** (required, max 120 characters)
3. **Content items** — multi-select from APPROVED content tagged as sponsor material
4. **Override level** — this field is read-only and displays "L4 — Sponsor (constitutional maximum)". The field is not a dropdown; it is an informational label. No operator can set this to L5 or L6.
5. **Contract start date** (required, date picker)
6. **Contract end date** (required, date picker; must be after start date)
7. **Contracted SOV** — number field, percentage (e.g., "25"). Validation: 0 < value ≤ 100.
8. **Screen scope** — multi-select of venue zones/screens this contract applies to
9. **Time window** — daily hours the contract SOV applies (e.g., "09:00–22:00")
10. **Notes** (optional, max 500 characters)

**If the operator attempts to set override level above L4 through any mechanism (URL manipulation, API call):**
The server returns:
```
HTTP 422 — Governance Violation
{
  "error": "SPONSOR_LEVEL_CEILING_EXCEEDED",
  "message": "Sponsor content may not exceed override level L4. This constraint is constitutional and cannot be overridden by any operator or administrator.",
  "requested_level": "L5",
  "maximum_permitted": "L4"
}
```
The CMS surface renders:
```
✗ Governance violation: Sponsor content cannot exceed L4 override level.
This limit is a constitutional constraint, not a configuration setting.
Contact platform support if you believe this is in error.
```

#### 3.4.3 Sponsor Content Preview

Within a sponsor item's detail panel, a "Preview on venue" control allows the operator to preview what the sponsor content looks like in context before delivery:

- Venue selector: pick a target venue
- Zone/screen selector: pick a screen from that venue
- Time selector: pick a time of day
- Button: "Preview delivery"

Preview result: renders the PRE resolution output for the selected venue/screen/time combination, showing the winning content. If sponsor content would win at that time, it is shown. If it would be suppressed, the suppressor is shown with the reason:
```
At [VENUE] / [SCREEN] / [TIME]:
Sponsor content is SUPPRESSED by Override_004 (L1)
Winning content: [CONTENT_NAME]
[Review Override_004]
```

The preview uses `_preview: true` stamped data and never reaches production rendering.

#### 3.4.4 Sponsor Contract Expiry Indicator

When a sponsor contract is within 30 days of expiry, the row in the sponsor list displays an amber "Expiring soon" badge. Within 7 days: red "Expiring in [N] days" badge.

When a sponsor contract expires:
- The sponsor row moves to an "Expired contracts" section (collapsed by default, toggle "Show expired")
- Content items associated with the expired contract are not automatically archived — they remain in the library but the sponsor association is flagged as "Contract expired [DATE]"
- Scheduled slots using expired sponsor content are flagged with a warning: "Sponsor contract expired — review this slot"
- The system does not automatically remove expired sponsor content from active slots. This is a manual operator decision to prevent unintended content gaps.

---

### Tab 5: Delivery Status

**Route:** `/cms/delivery`
**Minimum role to view:** Viewer
**Minimum role to trigger re-delivery:** Venue Admin
**Minimum role to force re-delivery (ADMIN action):** Network Admin

#### 3.5.1 Per-Venue Delivery Status Table

Table columns:

| Column | Description |
|---|---|
| Venue name | Linked to Venue Operations Dashboard |
| Last sync | Governed timestamp of last successful corpus sync |
| Sync age | Relative time ("3 hours ago", "12 days ago") |
| Corpus hash | Short hash display (first 8 characters) |
| Hash verified | ✓ Verified / ✗ Not verified / — Unknown |
| Pending items | Count of scheduled items not yet confirmed delivered |
| Failed items | Count of items with FAILED delivery state |
| Stale items | Count of items with STALE delivery state |
| Overall status | CURRENT / PENDING / FAILED / STALE |
| Actions | View detail / Trigger re-delivery |

**Overall status derivation:**
- CURRENT: hash verified, no failed or stale items, last sync within 4 hours
- PENDING: no failures, but pending items exist or last sync is between 4–24 hours ago
- STALE: last sync older than 24 hours (see 3.5.2 for STALE threshold)
- FAILED: any item in FAILED state, or hash verification failure

Table is filterable by: Overall status | Venue name (search) | Region

#### 3.5.2 Delivery State Per Item

Clicking a venue row expands to show per-item delivery status for all scheduled content at that venue.

| State | Badge | Meaning |
|---|---|---|
| DELIVERED | Green | Corpus hash confirmed at venue; item is in the active corpus |
| PENDING | Amber | Item is in the queue but delivery not yet confirmed |
| FAILED | Red | Delivery attempted; venue returned error or hash mismatch |
| STALE | Grey | Item was previously DELIVERED but last sync is older than 24 hours |

**STALE threshold:** An item transitions from DELIVERED to STALE when the last corpus hash verification at the target venue is more than 24 hours old. This does not mean the content is absent from the venue — it means the platform cannot confirm the current state.

#### 3.5.3 72-Hour Countdown Per Item

For each scheduled item that is PENDING and has a scheduled play time in the future, the detail view shows a 72-hour countdown:

**>72 hours until play:**
```
[ITEM NAME]   PENDING
Scheduled play: Tuesday 18:00 AEST
Time until play: 4d 6h 22m
Delivery window: ✓ Sufficient time for delivery
```

**<72 hours until play:**
```
[ITEM NAME]   PENDING  ⚠ AT RISK
Scheduled play: Tomorrow 18:00 AEST
Time until play: 1d 4h 12m
Delivery window: ⚠ Within 72-hour minimum — verify delivery is in progress
```

**<24 hours until play:**
```
[ITEM NAME]   PENDING  ✗ CRITICAL
Scheduled play: Today 18:00 AEST
Time until play: 6h 12m
Delivery window: ✗ Less than 24 hours — content may not reach venue in time
[Trigger emergency re-delivery] [Contact venue to verify local corpus]
```

#### 3.5.4 Manual Re-Delivery Trigger

Button label: "Trigger re-delivery"
Available to: Venue Admin and above, for FAILED or STALE items only
Not available for: DELIVERED or PENDING items (no re-delivery needed / already in flight)

Clicking opens a confirmation dialog:
```
Trigger re-delivery?

Venue: [VENUE_NAME]
Items: [N] FAILED + [N] STALE
This will queue a corpus sync to the venue. Delivery is not instantaneous — allow 30–90 minutes.

[Cancel] [Confirm re-delivery]
```

On confirm: the item(s) move to PENDING state and a re-delivery job is queued. A toast notification: "Re-delivery triggered for [VENUE_NAME]. Estimated completion: 30–90 minutes."

**Force re-delivery (Network Admin only):**
A "Force re-delivery" button (distinct from "Trigger re-delivery") bypasses the normal queue priority and promotes the delivery job. Available only to Network Admin. Requires a confirmation step with a justification field (required, min 20 characters).

#### 3.5.5 Failed Delivery Details

Clicking a FAILED item expands an error detail section:
```
Delivery failure details — [ITEM_NAME] at [VENUE_NAME]

Last attempt: [TIMESTAMP]
Error type:   HASH_MISMATCH / CONNECTION_TIMEOUT / CORPUS_REJECTED / UNKNOWN
Error detail: [Raw error message from delivery system]

Previous attempts: [N] (last [N] failed)
First failure: [TIMESTAMP]

[Retry delivery]  [View venue status]  [Open support ticket]
```

---

### Tab 6: Content History / Audit

**Route:** `/cms/history`
**Minimum role to view:** Viewer
**Minimum role to filter by operator:** Operator

#### 3.6.1 Content Change Log

Chronological log of all content operations. Displayed as a reverse-chronological list (most recent first).

**Log entry anatomy:**

```
[TIMESTAMP]  [OPERATOR_NAME]  [ROLE_AT_TIME]
Action: [cms:content:uploaded | cms:schedule:slot_created | cms:approval:approved | ...]
Target: [CONTENT_TITLE or SLOT_NAME]
Venue scope: [VENUE_NAME or "All venues" or "Network"]
Detail: [Human-readable summary of what changed]
```

#### 3.6.2 Approval Chain History

Clicking any "submitted for approval" or "approved/rejected" event in the log expands the full approval chain for that item:

```
Approval chain — [SLOT_NAME]
─────────────────────────────────────────────────────────
Submitted by:  [OPERATOR_A]  [TIMESTAMP]
Reviewed by:   [OPERATOR_B]  [TIMESTAMP]
Decision:      APPROVED
Note:          "Content verified correct for weekend schedule"
─────────────────────────────────────────────────────────
```

If the item was rejected and resubmitted, the full chain shows all iterations.

#### 3.6.3 Corpus Hash History Per Venue

A sub-section "Corpus delivery log" shows, per venue, the sequence of corpus hash confirmations:

| Timestamp | Corpus hash | Verified | Operator |
|---|---|---|---|
| [TIMESTAMP] | `a1b2c3d4` | ✓ | System |
| [TIMESTAMP] | `e5f6g7h8` | ✓ | System |
| [TIMESTAMP] | — | ✗ Hash mismatch | System |

Clicking a hash entry shows the full set of content items in that corpus version.

#### 3.6.4 Filters

- **Date range:** Date picker (start and end date). Default: last 7 days.
- **Operator:** Dropdown of all operators who have made changes (filtered to operators the current user has scope over)
- **Content item:** Search by content title
- **Action type:** Upload / Schedule / Approval / Delivery / Template / Sponsor
- **Venue:** Venue selector

Filter controls appear in the tab header bar. A "Clear filters" button resets all to defaults.

---

## 4. Zone C — Content Preview Panel

Zone C is a collapsible right-side panel. It is always available in CMS but collapsed by default. Expand via the "Preview" toggle button in the top-right corner of Zone B.

### 4.1 Selected Content Preview

When an operator clicks a content item (in Content Library, Schedule Builder slot, or Sponsor Management), Zone C populates with:

**Content preview area:**
- Video/image/loop rendered in a 16:9 preview frame
- Playback controls for video content (play, pause, scrub, fullscreen)
- Duration display

**Metadata panel:**
- Title, type, duration, tier, governance status
- Upload date and operator
- Tags

**Schedule slots using this content:**
- List of slots referencing this content item
- Each entry: slot name, venue, time range, approval status
- Clicking a slot entry highlights it in Schedule Builder (if Tab 2 is active) or navigates to Tab 2 with that slot selected

### 4.2 Venue Simulation — "Preview at this venue"

A "Preview at venue" selector in Zone C allows operators to preview what the content would look like in the context of a specific venue's current schedule:

1. **Venue selector** — dropdown of venues in scope
2. **Screen selector** — dropdown of screens at selected venue
3. **Date/time selector** — pick a future date and time
4. **"Run preview" button**

**Preview result:**
```
Preview: [VENUE] / [SCREEN] / [DATE] [TIME]

At this time, the PRE resolution would deliver:
  Level: L[N]
  Winning content: [CONTENT_NAME]

[If the selected content would not win:]
Selected content would NOT play at this time.
Suppressed by: [WINNING_CONTENT] via L[N] [RULE_TYPE]
```

Result is stamped `_preview: true`. A "PREVIEW — not live data" watermark appears in Zone C when preview mode is active.

### 4.3 Confidence Indicator for Scheduled Delivery

When an operator selects a scheduled slot (not a standalone content item), Zone C shows a delivery confidence indicator:

```
Delivery confidence: HIGH / MEDIUM / LOW / CRITICAL

Basis:
  72h window:      ✓ 4 days until play — sufficient
  Corpus status:   ✓ Last sync 2 hours ago
  Venue online:    ✓ Heartbeat current
  Approval status: ✓ APPROVED
```

If any signal is degraded, the confidence drops and the degraded signal is shown in amber/red.

---

## 5. State Variations

### 5.1 Normal Authoring State

- All tabs accessible per role
- 72-hour banner shows safe scheduling boundary
- Approval workflow available
- Content upload enabled
- Delivery status polling at 60-second intervals

### 5.2 Pending Approval (Content Locked for Editing)

Slots and content items in PENDING_APPROVAL state display all fields as read-only. No edit controls appear. The slot bar in Schedule Builder shows an amber lock icon. The following actions remain available:

- "Withdraw submission" (available to the submitting operator only)
- "Approve" / "Reject" (available to authorized reviewers)
- "Preview" (available to all with view access)

The content item card in Content Library shows a "Pending approval" badge. The card's edit actions are replaced with a single "View submission" action.

### 5.3 EMERGENCY_FREEZE — What Changes on This Surface

When `ConstitutionalState.state: "EMERGENCY_FREEZE"`:
- Zone A CMS navigation items are visually disabled (not absent)
- A red banner appears at the top of every CMS tab: "EMERGENCY FREEZE ACTIVE — Content authoring is suspended. Read-only access only."
- All write actions (upload, create slot, submit for approval, approve, re-delivery trigger) are disabled
- Controls that are role-restricted and state-restricted use Rule AU-02 treatment: visible, disabled, with tooltip "Unavailable during Emergency Freeze"
- Operators may still view all tabs, run previews, and review delivery status
- The "Trigger re-delivery" button is disabled. Emergency content delivery is handled by the Platform runtime, not the CMS surface.
- Navigation to CMS tabs is permitted (read-only). Zone A does not block navigation.

### 5.4 Training Mode

See Section 8 for the complete training mode specification.

**Summary of training-mode differences visible on this surface:**
- A persistent yellow bar at the top of every CMS tab: "TRAINING MODE — Content authored here goes to the simulation endpoint, not live venues."
- Every content item card shows a "SIMULATION" badge
- "Submit for approval" becomes "Submit (training scenario)"
- Delivery Status tab shows "Simulation venues only" — no real venue data
- The 72-hour rule is not enforced in training mode (simulation scenarios may include tight timelines for learning purposes)

### 5.5 Offline (Cannot Reach Backend)

When the WebSocket connection is lost and polling fails:
- SystemStatusBar in Zone A displays: "Connection lost — last update [AGE] ago" in amber
- Tab header in each CMS tab shows: "Working offline — changes will be saved locally and submitted when connection restores"
- Upload new content is disabled (requires server connection)
- Existing DRAFT edits in local state are preserved and flagged as "Unsaved — offline"
- Approval actions are disabled with tooltip: "Approval actions require a live connection"
- Delivery Status tab shows all items with `_freshness: EXPIRED` treatment
- Read-only browsing of locally cached content, schedules, and templates continues

On reconnection: a banner prompts "Connection restored. [Sync pending changes]" The sync button submits locally queued changes.

---

## 6. The 72-Hour Rule — Complete UX Specification

### 6.1 Where the 72-Hour Countdown Appears

| Location | Treatment |
|---|---|
| Tab 2 (Schedule Builder) header | Persistent "safe scheduling boundary" banner |
| Tab 2 slot bar (timeline view) | Color/stripe treatment on slot bars within the danger zone |
| Tab 2 slot form | Warning/error badge on the time range fields |
| Tab 5 (Delivery Status) per-item detail | Countdown text with color-coded urgency |
| Zone C (Preview Panel) confidence indicator | "72h window" signal in delivery confidence summary |
| Approval confirmation dialog | Warning text when slot is within 72h window |

### 6.2 Visual Treatment by Time Remaining

**Greater than 72 hours until play:**
- Slot bar: normal display (solid color per approval status)
- No warning badge
- Delivery confidence: "72h window: ✓ Sufficient time"

**Less than 72 hours, greater than 24 hours until play:**
- Slot bar: amber diagonal stripe overlaid on status color
- Slot form warning badge: "⚠ This slot is within the 72-hour delivery window. Verify delivery is in progress before submitting."
- Approval confirmation adds: "⚠ Warning: This slot is within the 72-hour delivery window. Delivery may not reach all venues before play time."
- Submission is not blocked; the operator must acknowledge the warning to proceed

**Less than 24 hours, greater than 6 hours until play:**
- Slot bar: red solid outline, amber diagonal stripe
- Slot form error: "✗ This slot starts in less than 24 hours. Submission is blocked. To schedule this content, verify delivery manually or adjust the start time."
- Submission is blocked; "Submit for approval" button is absent from the DOM

**Less than 6 hours until play:**
- Slot bar: red solid outline, red diagonal stripe, blinking (≤ 1 Hz pulse)
- Slot form error: "✗ CRITICAL: This slot starts in [N] hours. Content cannot be delivered in time through normal corpus sync. If this content must play, contact your Network Admin for emergency delivery options."
- Submission is blocked
- "Trigger emergency re-delivery" button appears, available to Venue Admin and above, linking to Tab 5 delivery controls for the affected venue

### 6.3 Interaction with Manual Delivery Trigger

If an operator has triggered manual re-delivery via Tab 5 for a PENDING item, and the delivery is confirmed (item transitions to DELIVERED), the 72-hour warning on the corresponding schedule slot clears:

- Slot bar returns to normal display (no stripe)
- Zone C confidence indicator updates: "72h window: ✓ Delivery confirmed"
- The "Submit for approval" button re-appears if it was blocked solely by the 72-hour rule

Delivery confirmation is polled at 60-second intervals. The slot warning clears within one poll cycle of delivery confirmation.

### 6.4 Warning Text — Exact Strings

| Condition | Warning string |
|---|---|
| <72h, >24h (soft warning) | "⚠ This slot is within the 72-hour delivery window. Verify delivery is in progress before submitting." |
| <24h (submission blocked) | "✗ This slot starts in less than 24 hours. Submission is blocked. Adjust the start time or manually verify delivery." |
| <6h (critical, emergency) | "✗ CRITICAL: Content cannot be delivered in time through normal corpus sync. Contact your Network Admin for emergency delivery options." |
| Delivery confirmed (clears warning) | "✓ Delivery confirmed. 72-hour constraint satisfied." |

---

## 7. Sponsor Content Governance UX

### 7.1 L4 Ceiling — Where It Appears and How It Is Enforced

The L4 ceiling is displayed in three locations:

1. **Tab 4 (Sponsor Management) header banner** — always visible, describes the constitutional constraint (full text in Section 3.4.1)
2. **Sponsor slot form — override level field** — read-only label, not a dropdown
3. **Tab 2 (Schedule Builder) — override level dropdown for sponsor slots** — shows L4 as the only selectable option for sponsor content; L5/L6 options are absent

**Error message when L5 or L6 assignment is attempted (server-side rejection):**
```
✗ Governance violation: Sponsor content cannot exceed L4 override level.
This limit is a constitutional constraint, not a configuration setting.
Requested level: L[N]
Maximum permitted: L4
Contact platform support if you believe this is in error.
[Dismiss]
```

This error renders in a red inline alert beneath the override level field, not as a modal. The form remains open; no data is cleared.

### 7.2 Sponsor Contract Expiry Indicator

- 30–7 days before expiry: amber "Expiring soon — [N] days" badge on sponsor row
- 7 days or fewer before expiry: red "Expiring in [N] days" badge
- Day of expiry: red "Expires today" badge; a notification is sent to the Venue Admin and any operator with the sponsor in their scope
- After expiry: sponsor row moves to "Expired" section; all associated scheduled slots show a warning badge; content is NOT automatically removed

**At expiry, scheduled slot warning:**
```
⚠ Sponsor contract expired
The sponsor contract for [SPONSOR_NAME] expired on [DATE].
This slot is still configured and will play until manually changed.
Review whether this content should continue, be replaced, or be archived.
[Review slot]  [Archive sponsor content]
```

### 7.3 Sponsor Content Preview Before Delivery

Described in Section 3.4.3. The preview explicitly shows whether the sponsor content would win or be suppressed at the selected venue/screen/time. This is the operator's tool for verifying sponsor delivery before committing to the schedule.

---

## 8. Training Mode — Complete Specification

### 8.1 Training Mode Indication on This Surface

When training mode is active:
- **Persistent yellow notification bar** at the top of every CMS tab (below the Zone A boundary, above the tab content): "TRAINING MODE — Content authored here goes to the simulation endpoint only. No changes affect live venues."
- **"TRAINING MODE" watermark** in light grey diagonally across Zone B content area (low opacity, does not obscure content)
- **Every content item card and row** in all tabs shows a "SIMULATION" badge in yellow
- **Zone A operator tools** shows "Training mode: ON" next to the toggle with an amber indicator dot

### 8.2 Simulation Marker on Training Mode Content

Every content item, schedule slot, template application, and sponsor record created during training mode is stamped `_simulation: true` on the server. The CMS surface validates this marker on every API response consumed during training mode (per Rule TR-02 in FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md).

If the CMS receives an API response without `_simulation: true` during training mode:
- The response data is not displayed
- An error banner appears: "Training data source error — data received without simulation marker. Please refresh. If this persists, contact your administrator."
- The event is logged to the observability sink

### 8.3 Endpoint Separation — What the Operator Sees

Zone C shows the simulation endpoint URL when training mode is active:
```
Simulation endpoint: https://sim.clubhub.internal/api/sim/
(Production endpoint not in use during training mode)
```

This label appears in the Zone C header during training mode. It is not interactive; it is informational confirmation that actions are targeting the simulation, not production.

### 8.4 Entering and Exiting Training Mode

**Enter:** Operator Tools (Pane A4) → "Training mode" toggle → confirmation dialog: "Switch to training mode? All content operations will target the simulation endpoint. No changes will affect live venues. [Cancel] [Enter training mode]"

On confirm: page reloads to flush all live-data caches and re-establish connections to the simulation endpoint. A toast appears: "Training mode active — simulation endpoint connected."

**Exit:** Operator Tools (Pane A4) → "Training mode" toggle (currently ON) → confirmation dialog: "Exit training mode? You will return to the live production environment. Any training-mode content remains in the simulation only. [Cancel] [Exit training mode]"

On confirm: page reloads to flush simulation caches and re-establish production connections. Toast: "Live mode restored — production endpoint connected."

Minimum role to enter training mode: Viewer. Minimum role to create training-mode content: Content Creator. Training mode is per-session, not per-operator; it does not persist across browser sessions.

### 8.5 Training Mode Content Never Reaches Live Corpus

The enforcement mechanism is network-layer, not frontend-layer: the simulation endpoint (`/api/sim/...`) does not proxy to the production backend. Training-mode content cannot be promoted to the live corpus through the CMS surface.

The CMS communicates this to operators through:
1. The persistent "TRAINING MODE" bar (Section 8.1)
2. The simulation endpoint label in Zone C (Section 8.3)
3. The absence of "Deploy to live venues" actions in training mode — delivery-related controls in Tab 5 show simulated venues only; the "Trigger re-delivery" button is absent (simulation handles its own delivery model)

---

## 9. Interactive Controls — Complete Inventory

| Control | Label | Location | Action | Role required | State required | Confirmation required |
|---|---|---|---|---|---|---|
| Button | "Upload content" | Tab 1 header | Opens upload form | Content Creator | Not EMERGENCY_FREEZE | No |
| Button | "Submit for approval" | Content item / Schedule slot | Submits item for review | Content Creator | Item in DRAFT state | Yes — dialog with slot summary |
| Button | "Withdraw submission" | Pending item | Returns item to DRAFT | Original submitter | Item in PENDING_APPROVAL | Yes — dialog |
| Button | "Approve" | Approval detail panel | Approves item | Venue Admin (venue scope) | Item in PENDING_APPROVAL | No |
| Button | "Reject" | Approval detail panel | Opens rejection note form | Venue Admin (venue scope) | Item in PENDING_APPROVAL | Yes — rejection note required |
| Button | "Archive" | Content item actions | Archives content item | Venue Admin | Item not in LIVE state | Yes — dialog with in-use warning if applicable |
| Button | "Create template" | Tab 3 header | Opens template create form | League Admin | Not EMERGENCY_FREEZE | No |
| Button | "Add sponsor" | Tab 4 header | Opens sponsor form | Venue Admin | Not EMERGENCY_FREEZE | No |
| Button | "Trigger re-delivery" | Tab 5 venue row | Queues corpus sync | Venue Admin | Item in FAILED or STALE state | Yes — dialog with venue and item count |
| Button | "Force re-delivery" | Tab 5 venue row | Promotes delivery job priority | Network Admin | Item in FAILED or STALE state | Yes — dialog with justification field required |
| Button | "Preview at venue" | Zone C | Runs PRE preview | Viewer | Not offline | No |
| Toggle | "Training mode" | Zone A — Operator Tools | Switches to simulation endpoint | Viewer | Any | Yes — separate dialogs for enter and exit |
| Toggle | View toggle (grid/list) | Tab 1 header | Switches card/list view | Viewer | Any | No |
| Filter controls | Type / Tier / Status / etc. | Tab headers | Filters list | Viewer | Any | No |
| Sort controls | Column header clicks | Tab tables | Sorts table | Viewer | Any | No |
| Date picker | Schedule date selector | Tab 2 header | Sets timeline date | Viewer | Any | No |
| Drag-and-drop | Content item onto timeline | Tab 2 canvas | Creates draft slot | Content Creator | Not EMERGENCY_FREEZE | No |
| Resize handles | Slot bar ends | Tab 2 timeline | Adjusts slot time range | Content Creator | Slot in DRAFT state | No |
| Link | "View past application" | Template detail | Opens replay record | Operator | Any | No |
| Button | "Proof of Play" | Tab 4 sponsor row | Opens proof-of-play report | Venue Admin | Any | No |

---

## 10. Audit Events Emitted

All events use the format `{domain}:{entity}:{action}`. CMS events use the `cms` domain.

| User action | Event name | Payload includes |
|---|---|---|
| Content item uploaded | `cms:content:uploaded` | content_id, title, type, tier, operator_id, governed_timestamp |
| Content item submitted for approval | `cms:content:approval_submitted` | content_id, operator_id, governed_timestamp |
| Content item approved | `cms:content:approved` | content_id, approver_id, governed_timestamp |
| Content item rejected | `cms:content:rejected` | content_id, approver_id, rejection_note, governed_timestamp |
| Content item archived | `cms:content:archived` | content_id, operator_id, governed_timestamp |
| Schedule slot created | `cms:schedule:slot_created` | slot_id, content_id, venue_id[], time_range, tier, operator_id, governed_timestamp |
| Schedule slot updated | `cms:schedule:slot_updated` | slot_id, changed_fields[], operator_id, governed_timestamp |
| Schedule slot deleted | `cms:schedule:slot_deleted` | slot_id, operator_id, governed_timestamp |
| Schedule slot submitted for approval | `cms:schedule:approval_submitted` | slot_id, operator_id, governed_timestamp |
| Schedule slot approved | `cms:schedule:approved` | slot_id, approver_id, governed_timestamp |
| Schedule slot rejected | `cms:schedule:rejected` | slot_id, approver_id, rejection_note, governed_timestamp |
| Template created | `cms:template:created` | template_id, type, tier, operator_id, governed_timestamp |
| Template applied | `cms:template:applied` | template_id, venue_id, operator_id, governed_timestamp |
| Template archived | `cms:template:archived` | template_id, operator_id, governed_timestamp |
| Sponsor record created | `cms:sponsor:created` | sponsor_id, campaign_name, tier, sov_contracted, operator_id, governed_timestamp |
| Sponsor record updated | `cms:sponsor:updated` | sponsor_id, changed_fields[], operator_id, governed_timestamp |
| Sponsor record deactivated | `cms:sponsor:deactivated` | sponsor_id, operator_id, governed_timestamp |
| Delivery re-triggered | `cms:delivery:redelivery_triggered` | venue_id, item_ids[], operator_id, governed_timestamp |
| Delivery force re-triggered | `cms:delivery:force_redelivery_triggered` | venue_id, item_ids[], operator_id, justification, governed_timestamp |
| Training mode entered | `cms:training:mode_entered` | operator_id, governed_timestamp |
| Training mode exited | `cms:training:mode_exited` | operator_id, governed_timestamp |
| Sponsor L4 ceiling violation attempted | `cms:governance:sponsor_ceiling_violation` | attempted_level, operator_id, governed_timestamp |
| Template tier violation attempted | `cms:governance:template_tier_violation` | attempted_tier, operator_tier, operator_id, governed_timestamp |
| PRE preview run | `cms:preview:run` | content_id, venue_id, screen_id, simulated_time, operator_id, governed_timestamp |
| Proof of play report generated | `cms:sponsor:proof_of_play_generated` | sponsor_id, venue_id, period, operator_id, governed_timestamp |

---

## 11. Forbidden Patterns

The following patterns are explicitly forbidden on this surface. Any design or implementation that introduces these patterns must be rejected.

**FP-01: No direct live override from CMS**
The CMS Content Operations Surface must not provide any control that places a live operational override on a venue screen. Overrides (L1–L6) are managed through the Incident Commander or Live Operations surfaces. The CMS authors and schedules content for future delivery; it does not intervene in live screen state.

**FP-02: No immediate effect on live venues**
Content authoring in the CMS does not affect live venue state immediately. There is no "push to live now" button. The 72-hour delivery pipeline is the only path for content to reach venues. Any feature that shortcuts this pipeline is a governance violation.

**FP-03: No sponsor content above L4**
Sponsor content may never be assigned an override level above L4 on any form, dropdown, API call, or data migration. The L4 ceiling is constitutional. Any UI element that implies L5 or L6 is achievable for sponsor content is a forbidden pattern, including disabled L5/L6 options in a dropdown (which imply the ceiling is a permission issue, not a constitutional constraint).

**FP-04: No approval of own content (Content Creator)**
A Content Creator may not approve their own submitted content. The approval controls must be absent from the DOM for the submitting operator when viewing their own pending submission.

**FP-05: No write actions in training mode to production endpoints**
Training mode write operations must target only the simulation API endpoint. Any action that would write to `/api/...` (not `/api/sim/...`) during training mode is a forbidden pattern. This is enforced at the network layer but must also be enforced at the component layer.

**FP-06: No content state optimism**
If delivery status is UNKNOWN or absent, the surface must not infer that delivery is successful. "Delivery status unavailable" is the correct rendering. "Delivered" is only rendered when `_freshness: CURRENT` and `state: DELIVERED` are both confirmed.

**FP-07: No dismissal of the 72-hour banner**
The 72-hour safe scheduling boundary banner in Tab 2 must not be dismissible. It is not a notification; it is a persistent operational constraint visible at all times during schedule authoring.

**FP-08: No archive of content with LIVE scheduled slots without explicit confirmation**
Archiving content that is currently referenced by LIVE or APPROVED schedule slots must block with an explicit warning and require operator confirmation. Silent archive of in-use content is a forbidden pattern.

**FP-09: No training-mode content in the live corpus**
Training mode content must never reach the live corpus. The simulation endpoint enforces this at the network layer. Any mechanism that could allow training-mode content to bypass the simulation endpoint is a forbidden pattern.

**FP-10: No governance violation of template tier authority**
Operators cannot create, edit, or apply templates at a tier above their role authority. The tier field must be constrained in the create form, and the server must enforce it independently. "Operator can see the option but cannot select it" (disabled option) is not an acceptable enforcement pattern — the option must be absent from the dropdown.

---

*End of CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md*
*Document authority: Agent 3 (UX/Design)*
*Delivery pipeline constraints require Agent 1 (Platform) review*
*CMS data shapes require Agent 2 (CMS) implementation coordination*
*Sponsor governance ceiling is constitutional — changes require engineering constitutional review*
