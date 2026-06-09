# Frontend Applications

**Document type:** Engineering implementation planning
**Status:** Actionable — implementation-ready specifications
**Authority:** ENGINEERING-CONSTITUTION-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §10, UX Architecture phases

---

## App 1: cms-web (React — Operator Console)

**Target users:** VENUE_OPERATOR, REGIONAL_MANAGER, ENTERPRISE_ADMIN, PLATFORM_ADMIN
**Tech stack:** React 18, TypeScript, React Query (TanStack Query), Zustand, React Router v6

---

### State Management Architecture

Three distinct state concerns, each with a different tool:

**Server state — React Query (TanStack Query):**
Campaigns, venues, screens, schedules, overrides, sponsorships, content items, corpus versions, audit summaries. All server data goes through React Query. Rationale: React Query provides cache invalidation on mutation, background refetch, stale-while-revalidate, and loading/error states — all of which the operator console needs. After an operator creates an override, the overrides list should immediately reflect it; React Query's `invalidateQueries` on mutation makes this trivial.

**Real-time state — WebSocket subscription (custom hook over native WebSocket):**
Emergency status per venue, constitutional state, canary stage changes, entropy alert inbox. These are push-only from server to client. They do not go through React Query (which is pull-based) but through a dedicated WebSocket context provider that updates Zustand slices. Rationale: Operators must see emergencies appear without polling. Constitutional state must update in near-real-time — an operator watching the constitutional state screen must see a FREEZE appear within seconds.

**Local UI state — Zustand:**
Modals open/closed, sidebar collapse, selected venue context (the venue the operator is currently managing), multi-step wizard state (e.g., emergency trigger two-step), pending confirmation tokens. Rationale: Zustand is lightweight, does not require Redux boilerplate, and is well-suited to shallow UI state that does not need to be shared across many components. The Redux DevTools plugin works with Zustand for debugging.

---

### Route Structure

All routes are prefixed with the operator's organization context. PLATFORM_ADMIN routes are under `/platform/`.

```
/login                              — Public
/                                   → redirect to /dashboard

/dashboard                          — VENUE_OPERATOR+ — Fleet overview, entropy alerts, active emergencies
/venues                             — VENUE_OPERATOR+ — Venue list
/venues/:venue_id                   — VENUE_OPERATOR+ — Venue dashboard
/venues/:venue_id/screens           — VENUE_OPERATOR+ — Screen list for venue
/venues/:venue_id/screens/:id       — VENUE_OPERATOR+ — Screen detail, last resolution, entropy score
/venues/:venue_id/emergency         — VENUE_OPERATOR+ — Emergency console for venue

/campaigns                          — VENUE_OPERATOR+ — Campaign list (all orgs in enterprise)
/campaigns/new                      — VENUE_OPERATOR+ — Create campaign
/campaigns/:campaign_id             — VENUE_OPERATOR+ — Campaign detail
/campaigns/:campaign_id/preview     — VENUE_OPERATOR+ — PRE preview for all campaign screens
/campaigns/:campaign_id/review      — REGIONAL_MANAGER+ — Review and approve/reject

/schedules                          — VENUE_OPERATOR+ — Schedule management
/schedules/new                      — VENUE_OPERATOR+ — Create schedule
/schedules/:schedule_id             — VENUE_OPERATOR+ — Schedule detail and edit

/overrides                          — VENUE_OPERATOR+ — Override list
/overrides/new                      — VENUE_OPERATOR+ — Create override
/overrides/:override_id             — VENUE_OPERATOR+ — Override detail, extend, cancel

/entropy                            — REGIONAL_MANAGER+ — Fleet entropy review dashboard
/entropy/venue/:venue_id            — VENUE_OPERATOR+ — Per-venue entropy breakdown
/entropy/screen/:screen_id          — VENUE_OPERATOR+ — Per-screen entropy detail

/audit                              — AUDITOR+ — Replay audit query
/audit/invocations                  — AUDITOR+ — Invocation list with filters
/audit/invocations/:id              — AUDITOR+ — Single invocation detail + reason trace
/audit/proof-of-play                — VENUE_OPERATOR+ — Proof-of-play report generator
/audit/integrity/:venue_id          — AUDITOR+ — Audit chain integrity verification

/canary                             — ENTERPRISE_ADMIN+ — Canary status dashboard
/canary/:enterprise_id              — ENTERPRISE_ADMIN+ — Canary detail, parity report, promotion readiness
/canary/:enterprise_id/advance      — ENTERPRISE_ADMIN+ — Promotion wizard (human approval token input)

/corpus                             — ENTERPRISE_ADMIN+ — Corpus version management
/corpus/versions                    — ENTERPRISE_ADMIN+ — Version history
/corpus/deployment                  — ENTERPRISE_ADMIN+ — Deployment group corpus status

/platform                           — PLATFORM_ADMIN only (separate layout, separate auth check)
/platform/constitutional            — PLATFORM_ADMIN — Constitutional state, freeze controls, freeze log
/platform/organizations             — PLATFORM_ADMIN — Organization management
/platform/screens/commission        — PLATFORM_ADMIN — Bulk screen commissioning
```

Route guard: every route checks the user's role against the minimum required. Unauthorized access shows a `403 Insufficient Permissions` page with an explanation of what role is required — not a silent redirect to login.

---

### Key Views

**Fleet Dashboard (`/dashboard`):**
- Cards per venue: entropy label, active emergency indicator, screen count, last heartbeat
- Global entropy alerts list: sorted by severity descending
- Active emergencies list: venue, activated_at, content preview
- Constitutional state banner (always visible if not NORMAL)
- Entropy score trend chart (24h rolling, per-enterprise)

**Emergency Console (`/venues/:venue_id/emergency`):**
- Current emergency status (active/inactive) with countdown if time-limited
- Emergency trigger button (opens two-step modal — see UX constraints)
- Emergency content preview: what players are currently showing
- Emergency history for this venue
- ENTERPRISE_ADMIN view adds: global emergency trigger across organization

**Campaign Manager (`/campaigns/:campaign_id`):**
- Campaign status with state machine visualization (which steps are complete)
- Campaign preview button: opens full-screen preview of PRE output for all relevant screens
- Submit for review button (VENUE_OPERATOR)
- Approve/reject controls (REGIONAL_MANAGER+) — approval requires seeing the preview first (enforced by requiring `preview_token` that is issued only after the preview is viewed)
- Schedule association: list of schedules referencing this campaign

**Canary Status (`/canary/:enterprise_id`):**
- Current stage with stage progression diagram
- Parity scores: 24h and 7d, with trend chart
- Promotion readiness checklist: each criterion (parity threshold, zero CLASS_3/4, invariant stability, etc.) shown as pass/fail
- Shadow venues list with per-venue parity score
- Rollback history
- Promote button (disabled if readiness fails; requires human approval token if ready)

**Constitutional Controls (`/platform/constitutional`):**
- PLATFORM_ADMIN only — rendered in an isolated layout with its own auth check
- Current constitutional mode displayed prominently
- GlobalConstitutionalBreaker state per fleet/enterprise
- EMERGENCY_FREEZE button (prominent, red, requires two-step confirmation)
- Reset button (enabled only if mode is not NORMAL; requires human_auth_token input)
- Freeze log: permanent record of all freeze/reset events
- Circuit breaker states: PRE, shadow, entropy, replay — shown as status indicators

---

### Constitutional UI Constraints

**READ_ONLY mode:**
- A full-width banner appears at the top of every page: "System is in constitutional READ_ONLY mode. All configuration changes are disabled. Emergency controls remain active."
- Every mutation button (Save, Create, Publish, Approve, Extend, etc.) is disabled and shows a tooltip on hover: "Disabled: System is in READ_ONLY mode. Contact your platform administrator."
- Forms are rendered in read-only state (inputs disabled, not hidden — operators can still see current values)
- The emergency trigger button and emergency clear button remain enabled
- The banner must be impossible to dismiss or hide

**EMERGENCY_FREEZE:**
- Full-screen overlay (modal, not dismissible) with: "PLATFORM EMERGENCY FREEZE ACTIVE. All operations suspended. Contact ClubHub platform support."
- The overlay has a single link to the platform constitutional status page
- Only PLATFORM_ADMIN users see the reset interface beneath the overlay
- The freeze log link is always visible so operators can see why the freeze was triggered

**Canary Promotion (two-step with token):**
- Step 1: Summary page — show current stage, next stage, readiness report, parity scores. Operator reads this.
- Step 2: Token entry page — operator must type a human approval token (minimum 8 characters). The UI makes clear this token is logged alongside the promotion record.
- The Promote button on step 2 is disabled until the token field has ≥8 characters.
- No "remember this token" feature — it must be entered fresh each time.

**Emergency trigger (two-step confirmation):**
- Trigger button opens a modal (not a simple confirm dialog)
- Modal shows: which venue, which content, is_global flag with warning if true, reason text field (required)
- "Confirm Emergency" button sends first call, receives confirm_token
- Second screen in modal: "Emergency will activate on all screens at this venue. This cannot be undone automatically." with a 10-second countdown before the final confirm button becomes active
- The confirm_token expires server-side in 30 seconds — if the operator takes longer, they must start over

---

### Dangerous UX Patterns — Explicitly Forbidden

The following patterns must never be implemented in cms-web:

**"Auto-acknowledge entropy" button:** There must be no button, checkbox, or batch action that acknowledges entropy alerts without an operator reading the alert detail. Entropy alerts exist because a human must review them. A bulk dismiss function would eliminate the review step. If operators request this, the answer is to improve entropy alert clarity — not to add bulk dismiss.

**Bulk publish without per-campaign preview:** Operators may not publish multiple campaigns in a single action without viewing a preview of each. There is no "publish all approved campaigns" button. Each campaign requires its own review-and-publish flow.

**Canary stage jump:** The UI must enforce that canary stages are sequential. The promotion flow shows only the next stage (e.g., SHADOW_ONLY → INTERNAL_CANARY). There is no dropdown to select an arbitrary target stage. If canary-service rejects a jump, the UI should never have offered it.

**EMERGENCY_FREEZE exit that looks automatic:** The reset button on the constitutional controls page must be surrounded by clear language that this is a human decision. It must not look like a "clear error" or "resolve issue" button. Label: "Platform Reset (Human Authorization Required)". The button color is neutral (not green). A reset confirmation dialog must include the sentence: "This action is permanently logged."

**Sponsor data on operator screens:** The operator console must never display sponsor-scoped proof-of-play data in a way that could be confused with operational data. Proof-of-play for sponsors is accessible only in the audit section, clearly labeled as sponsor-facing output.

---

## App 2: player-ui (Chromium fullscreen — Raspberry Pi)

**Target users:** None (non-interactive kiosk display)
**Tech stack:** React 18, TypeScript. Served as static build from player-runtime local HTTP server on port 3000. Chromium launched in kiosk mode: `chromium-browser --kiosk --app=http://localhost:3000`.

---

### Architecture

player-ui is a dumb renderer. It does not make any network calls to cloud services. All intelligence is in player-runtime (the Node.js process). The communication channel is a local WebSocket on `ws://localhost:3001` (internal — not accessible from outside the device).

```
[Pi device]
  player-runtime (Node.js) ←→ [cloud services]
       ↕ WebSocket on ws://localhost:3001
  player-ui (React in Chromium)
       ↕ IPC
  Chromium kiosk (fullscreen display)
```

### State received from player-runtime (WebSocket messages)

```typescript
// Full state push on connect and on every resolution cycle
type PlayerUIState = {
  type: 'state_update';
  payload: {
    screen_id: string;
    constitutional_mode: 'NORMAL' | 'READ_ONLY' | 'EMERGENCY_FREEZE';
    emergency: { content_id: string; activated_at: number; reason: string | null } | null;
    current_item: { content_id: string; duration_ms: number; source: ResolutionLevel; sponsored: boolean } | null;
    playlist: PlaylistItem[];
    corpus_version: string;
    last_resolved_at: number;
  };
};

// Heartbeat (every 10 seconds)
type HeartbeatMessage = { type: 'heartbeat'; ts: number };
```

### Rendering Requirements

**Normal playback:**
- Renders `current_item` as fullscreen content (image, video, or web asset depending on content type)
- Advances through `playlist` on `duration_ms` timer
- On playlist end: requests next resolution from player-runtime (player-runtime triggers PRE.resolve() and pushes new state)
- Asset loading: assets must be pre-cached from local corpus store. Chromium fetches via `http://localhost:3002/assets/:content_id` (served by player-runtime from local storage — no internet fetch during playback)

**Emergency content:**
- When `emergency` is non-null, render emergency content as a fullscreen overlay with z-index above all playlist content
- Emergency overlay cannot be dismissed by playlist logic — it can only be cleared by a cleared `emergency` field in the state update
- Emergency content animates in with a 200ms fade (smooth for TV display)
- Emergency overlay persists even if the underlying playlist item changes beneath it

**Offline / no corpus:**
- When player-runtime has no current_item (corpus not yet loaded, or corpus expired): render a branded holding screen ("ClubHub TV — Loading...") — not a blank screen and not an error message visible to viewers

**Constitutional mode display:**
- NORMAL: no UI indication (all content is live PRE output)
- READ_ONLY: small non-obtrusive indicator in the corner visible only to operators (not viewer-facing): "READ ONLY" in yellow
- EMERGENCY_FREEZE: emergency overlay (same as emergency content, but with a platform freeze message if no emergency content is configured)

**Asset type support (minimum viable):**
- Static images: JPEG, PNG, WebP — rendered via `<img>` tag
- Video: MP4 (H.264) — rendered via `<video autoplay muted loop>` tag
- HTML content: rendered in a sandboxed `<iframe>` with `allow-scripts` only
- Duration: images and HTML display for `duration_ms`; video plays for its natural duration unless `duration_ms` is shorter

**Missing asset handling:**
- If a content_id's asset is not in local cache: display a branded placeholder ("Content unavailable") for the item's `duration_ms`, then advance. Log the missing asset to player-runtime via WebSocket message. Never block playback for a missing asset.

**Rendering invariants (enforced in player-ui):**
- Emergency content is always rendered above all other content — z-index: 9999
- Sponsorship-sourced items (sponsored: true) must display for exactly their `duration_ms` — no early skip
- The display must never show a blank screen for more than 500ms (the offline holding screen must load in under 500ms from startup)

---

### No CMS Connection

player-ui has zero network configuration pointing to cloud services. It knows only two URLs:
- `ws://localhost:3001` — player-runtime state updates
- `http://localhost:3002/assets/:content_id` — local asset server

If player-runtime crashes: player-ui detects WebSocket disconnect, displays the offline holding screen, and retries connection every 5 seconds. It does not attempt to contact any cloud service directly.

---

## App 3: sponsor-portal (React — Read-only)

**Target users:** SPONSOR_STAKEHOLDER role only
**Tech stack:** React 18, TypeScript, React Query (for read-only data fetching). No Zustand needed — no complex local state.
**Deployment:** Static React app hosted on CDN. Talks to read-only API endpoints only.

---

### Route Structure

```
/login                    — SPONSOR_STAKEHOLDER login (isolated from operator auth)
/                         → redirect to /dashboard

/dashboard                — Campaign overview: all active sponsorship contracts
/campaigns/:content_id    — Campaign detail and preview
/proof-of-play            — Proof-of-play report generator and history
/support                  — Contact information
```

### Hard Navigation Restrictions

The sponsor-portal must be completely isolated from operator functionality. Implemented as:

1. **Separate authentication domain:** Sponsors authenticate with sponsor-scoped credentials. Their JWT tokens have `role: SPONSOR_STAKEHOLDER` and `sponsor_id: string`. The API validates that proof-of-play queries are scoped to the sponsor's contracted content_ids only.

2. **No admin routes:** The sponsor-portal has no routes for venues, screens, campaigns (in the operator sense), overrides, entropy, canary, or constitutional state. These routes do not exist in the sponsor-portal router — they are not just protected, they are absent.

3. **No parity data:** Sponsor users never see shadow/parity comparison data, canary stage status, or constitutional state. These concepts do not appear in the sponsor portal.

4. **No entropy data:** Sponsors do not see entropy scores. Entropy is an internal operational metric.

### Proof-of-Play

- Sponsors can query proof-of-play for their contracted content_ids within their contracted time window
- The API scopes queries to the sponsor's content_ids before hitting replay-audit-api
- Report shows: total impressions (audit records where content_id matches), estimated reach (screens × duration), time distribution chart
- Reports can be exported as PDF or CSV
- Sponsors can see current campaign status (DRAFT, APPROVED, ACTIVE, ARCHIVED) but cannot change it

### Implementation Notes

- Sponsor-portal is a thin static app. It makes read-only API calls to:
  - `GET /cms/v1/campaigns?sponsor_id={id}` — list of their campaigns
  - `POST /audit/v1/replay/proof-of-play` — scoped to their content_ids
  - `GET /cms/v1/content/:content_id` — asset preview
- No WebSocket connections — sponsors do not need real-time state
- No shared component library with cms-web — sponsors should not accidentally see operator UI patterns
- Session timeout: 8 hours (shorter than operator sessions — sponsors are not on-call)

### Access Control Verification (implementation checklist)

Before deploying sponsor-portal:
- Verify that `SPONSOR_STAKEHOLDER` JWT tokens are rejected by all operator API endpoints
- Verify that proof-of-play API validates `sponsor_id` in the token against the requested content_ids
- Verify there is no route in sponsor-portal that renders any component from cms-web's component library
- Verify that the sponsor-portal build has no environment variables pointing to operator API paths it should not know about
