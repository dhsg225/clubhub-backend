# Application Route and Navigation Architecture — v1

**Document type:** Implementation-grade architecture specification
**Audience:** Frontend engineering team
**Status:** Authoritative — do not deviate without architectural review
**Scope:** All application routes, navigation hierarchy, deep-link behavior, URL persistence contracts

---

## Definitions

**Route owner:** The entity whose ID is the primary key in the URL. The route owner determines URL validity and lifetime.

**Governed timestamp:** A timestamp that originates from the backend time authority. Frontend clocks are never used to determine data validity or URL expiry.

**Stable identifier:** A URL that must remain valid and resolvable for the lifetime of the referenced record. Stable identifiers may not be removed without a redirect contract.

**Deep-link:** A URL entered directly, shared via notification, or opened from a bookmark — where no prior application state can be assumed.

**Return URL pattern:** After authentication failure or session expiry, the application captures the requested URL and redirects back to it after successful re-authentication.

---

## Route Inventory

Every route in the application is defined here. Additional routes must be approved as architectural additions, not implementation decisions.

### Route Table

| Route pattern | Zone B workspace | Minimum role | Elevated session required | Route owner | Stable identifier |
|---|---|---|---|---|---|
| `/` | Redirect only | VIEWER | No | — | N/A |
| `/fleet` | Fleet Overview | OPERATOR | No | — | No |
| `/venues/:venue_id` | Venue Operations Dashboard | VIEWER | No | Venue | Yes |
| `/venues/:venue_id/incident/:incident_id` | Incident Commander Surface | OPERATOR | No | Incident | Yes |
| `/venues/:venue_id/replay` | Replay & Forensics Workspace | OPERATOR | No | Venue | No |
| `/venues/:venue_id/replay/:session_id` | Replay & Forensics Workspace (session) | OPERATOR | No | Replay session | Yes |
| `/incidents/:incident_id` | Incident Commander Surface | OPERATOR | No | Incident | Yes |
| `/cms` | CMS Workspace (last active tab) | OPERATOR | No | — | No |
| `/cms/schedule` | CMS — Schedule Manager tab | OPERATOR | No | — | No |
| `/cms/overrides` | CMS — Override Control tab | OPERATOR | No | — | No |
| `/cms/library` | CMS — Content Library tab | VIEWER | No | — | No |
| `/cms/sponsorship` | CMS — Sponsorship Manager tab | ADMIN | No | — | No |
| `/cms/venues` | CMS — Venue Assignments tab | ADMIN | No | — | No |
| `/cms/approvals` | CMS — Approval Queue tab | OPERATOR | No | — | No |
| `/training` | Training & Certification Workspace | VIEWER | No | — | No |
| `/training/:module_id` | Training Workspace — specific module | VIEWER | No | Module | No |
| `/training/simulation` | Training Workspace — simulation mode | OPERATOR | No | — | No |
| `/replay/:session_id` | Replay & Forensics Workspace (cross-venue) | OPERATOR | No | Replay session | Yes |

### Additional Routes

| Route pattern | Zone B workspace | Minimum role | Notes |
|---|---|---|---|
| `/login` | Authentication surface | None | Return URL preserved in query param |
| `/unauthorized` | Authority explanation surface | None | Renders role gap, not a generic 403 |
| `/not-found` | Entity resolution failure surface | VIEWER | Explains which entity was not found |

---

## Route Ownership

Route ownership defines which entity's existence and state determines whether a URL is valid. This is distinct from access control.

### Ownership Rules

**`/venues/:venue_id`**
Owner: Venue record. URL is valid for the lifetime of the venue. Venue deletion must produce a redirect to `/fleet` with an explanation, not a generic 404. Venue IDs are permanent — they may not be reassigned.

**`/venues/:venue_id/incident/:incident_id`**
Owner: Incident record. The venue in the URL provides context but does not determine URL validity. If `incident_id` resolves to a different `venue_id` than the URL path, the application must redirect to the canonical URL (`/incidents/:incident_id`) rather than reject the request. Incident records must remain resolvable for a minimum of 7 years after closure.

**`/venues/:venue_id/replay/:session_id` and `/replay/:session_id`**
Owner: Replay session record. The session must remain resolvable for the lifetime of the underlying corpus records. The `/venues/:venue_id/replay/:session_id` form is the canonical URL; `/replay/:session_id` is a convenience alias that redirects to the canonical form after resolving the session's venue.

**`/incidents/:incident_id`**
Owner: Incident record. This is the canonical incident URL. Redirects to `/venues/:venue_id/incident/:incident_id` where `venue_id` is derived from the incident's `scope_id`. The redirect must be transparent (client-side replace, not push) so the browser back button returns to the referrer, not the intermediate URL.

**`/cms/*`**
Owner: CMS workspace (no persistent entity). CMS tab URLs are navigational state, not durable identifiers. They do not carry lifetime guarantees beyond backwards-compatibility redirects when paths are restructured.

**`/training/:module_id`**
Owner: Training module definition. Module IDs may be versioned (e.g., `/training/corp-basics-v2`). The previous version URL must redirect to the latest version or to a module selection screen with an explanation.

**`/training/simulation`**
Owner: Active simulation session (ephemeral). This URL does not survive page reload unless the simulation session is persisted server-side. On reload without an active session, redirect to `/training`.

---

## Route Authority Requirements

### Authority Enforcement Rules

**Rule RA-01: Redirect on authority failure — never render 403**
When a route requires authority the current operator does not have, redirect to the correct destination with an explanation delivered through an `authorization_context` parameter. The `/unauthorized` route renders the explanation. Never render an HTTP 403 page or blank screen.

**Rule RA-02: Authority check precedes data fetch**
The authority check must be performed before any data request is issued. A route must not partially render then fail on authority.

**Rule RA-03: Role gap explanation**
When redirecting due to insufficient role, the destination must explain which role is required and what the operator's current role is. This is not a security disclosure — it is an operational requirement so operators can request role escalation from their administrator.

### Route Authority Table

| Route pattern | Minimum role | Elevated session required | Insufficient authority — redirect to | Insufficient authority — message |
|---|---|---|---|---|
| `/fleet` | OPERATOR | No | `/venues` (first assigned venue) | "Fleet overview requires Operator role" |
| `/venues/:venue_id` | VIEWER | No | `/unauthorized` | "You are not assigned to this venue" |
| `/venues/:venue_id/incident/:incident_id` | OPERATOR | No | `/venues/:venue_id` | "Incident management requires Operator role" |
| `/venues/:venue_id/replay` | OPERATOR | No | `/venues/:venue_id` | "Replay access requires Operator role" |
| `/venues/:venue_id/replay/:session_id` | OPERATOR | No | `/venues/:venue_id` | "Replay access requires Operator role" |
| `/incidents/:incident_id` | OPERATOR | No | `/unauthorized` | "Incident management requires Operator role" |
| `/cms` | OPERATOR | No | `/venues` | "CMS access requires Operator role" |
| `/cms/schedule` | OPERATOR | No | `/cms/library` | "Schedule management requires Operator role" |
| `/cms/overrides` | OPERATOR | No | `/cms/library` | "Override control requires Operator role" |
| `/cms/library` | VIEWER | No | — | (accessible to all roles) |
| `/cms/sponsorship` | ADMIN | No | `/cms/library` | "Sponsorship management requires Admin role" |
| `/cms/venues` | ADMIN | No | `/cms/library` | "Venue assignment requires Admin role" |
| `/cms/approvals` | OPERATOR | No | `/cms/library` | "Approval queue requires Operator role" |
| `/training` | VIEWER | No | — | (accessible to all roles) |
| `/training/:module_id` | VIEWER | No | `/training` | "Module requires prerequisites not yet met" |
| `/training/simulation` | OPERATOR | No | `/training` | "Simulation mode requires Operator role" |

### Elevation-Sensitive Routes

Elevated session is required only for specific actions within a route, not for the route itself. The following operations within routes require `elevation_active: true` in the session context:

- Override placement at L6 (within `/cms/overrides` and `/venues/:venue_id`)
- Incident declaration at S1 severity (within incident commander surfaces)
- Corpus verification override (within recovery workflows)
- Counterfactual replay execution (within `/venues/:venue_id/replay/:session_id`)

These are action-level authority requirements, not route-level requirements. The route renders; the action controls gate.

**Authority check contract:**
Approved: Check `session.elevation_active` before rendering L6 override controls; if false, render a "Require elevated session to access this action" indicator with an elevation request flow.
Forbidden: Redirect the entire route because an elevated action exists within it.
Operational consequence: Operators lose their navigation context and unsaved context state if a full route redirect is triggered by an action-level authority check.
Verification: Test that an OPERATOR without elevation can navigate to `/cms/overrides` and see all non-L6 overrides; confirm L6 placement is gated, not the route itself.

---

## Deep-Link Behavior

A deep-link is any URL opened without prior application session context. This includes shared URLs in notifications, bookmarks, and external links from incident management tooling.

### Deep-Link Resolution Process

```
URL received
  → Session valid? No → /login?return={encoded_url}
  → Session valid? Yes → Entity resolution
    → Entity found? No → Entity-specific redirect (see table below)
    → Entity found? Yes → Authority check
      → Authority sufficient? No → /unauthorized with explanation
      → Authority sufficient? Yes → Route renders
```

### Entity Resolution Table

| Route | Entity resolution | Entity not found | Entity in wrong state |
|---|---|---|---|
| `/venues/:venue_id` | Fetch venue by ID | Redirect to `/fleet` with "Venue not found" notice | N/A — venue record always valid |
| `/venues/:venue_id/incident/:incident_id` | Fetch incident by ID; derive venue from incident | Redirect to `/venues/:venue_id` with "Incident not found" | Incident closed → redirect to `/venues/:venue_id/replay` if session exists, else `/venues/:venue_id` |
| `/incidents/:incident_id` | Fetch incident; derive venue | Redirect to `/fleet` with "Incident not found" | Incident closed → resolve replay session if available |
| `/venues/:venue_id/replay` | Resolve venue; no specific session required | Redirect to `/venues/:venue_id` | N/A |
| `/venues/:venue_id/replay/:session_id` | Fetch session by ID | Redirect to `/venues/:venue_id/replay` with "Session not found" | Session closed (retained) → render as read-only archive; session closed (purged) → redirect with "Session data no longer available" |
| `/cms/*` | No entity resolution — tab switching only | N/A | N/A |
| `/training/:module_id` | Fetch module definition | Redirect to `/training` with "Module not found" | Module deprecated → redirect to successor module |
| `/training/simulation` | Resolve active simulation session | If no active session → redirect to `/training` | Session expired → redirect to `/training` with "Simulation session expired" |

### Deep-Link State Requirements

**`/venues/:venue_id`**
Requires: valid venue record. On arrival, the application initiates all venue data subscriptions in parallel. The workspace renders a loading state immediately (not a blank screen) and populates as data arrives. No prior application state is required.

**`/venues/:venue_id/incident/:incident_id`**
Requires: valid incident record. Venue is derived from incident, so the venue context populates automatically. Zone A updates to show the incident's venue in the venue selector and the incident in the incident list.

**`/venues/:venue_id/replay/:session_id`**
Requires: valid session record with matching venue. If the session's venue does not match the URL venue, redirect to the canonical URL for the session. Replay mode is activated immediately on route mount — no action required by the operator.

**`/incidents/:incident_id`**
Requires: valid incident record. Application redirects to `/venues/:venue_id/incident/:incident_id` with a client-side replace (history neutral). Zone A and Zone B populate with incident context.

**`/training/simulation`**
Requires: active simulation session OR instructor permission to start a new one. If a simulation session exists for this operator, resume it. If not, redirect to `/training` with a prompt to start a simulation from the training module.

### Notification-Sourced Deep-Links

Notifications must generate URLs that include sufficient context for deep-link resolution. The notification system must not generate URLs that require navigation history to resolve.

**Approved:** Notification for incident declaration generates `/incidents/inc-20260602-0847` — fully self-contained.
**Forbidden:** Notification generates a URL that requires the user to have previously visited the venue dashboard to establish context.
**Operational consequence:** Operators who receive a notification on a different device (e.g., mobile to desktop) cannot reach the incident if the URL requires prior session state.
**Verification:** Test all notification URL types by opening them in a fresh browser session with no prior history.

---

## Navigation Hierarchy

### Global Navigation — Zone A

Zone A is a persistent navigation surface. Its content does not change based on Zone B workspace.

**Rule NA-01: Zone A independence**
Approved: Zone A subscribes to its own data streams (venue list, active incidents, notifications). These subscriptions are established at application shell mount and remain active for the session lifetime.
Forbidden: Any workspace component (Zone B) writing to Zone A state, triggering Zone A data refetch, or modifying Zone A display based on Zone B content.
Operational consequence: If Zone A updates in response to Zone B workspace changes, operators lose stable navigation landmarks during incident response — they cannot rely on the venue list or incident list remaining consistent while switching workspaces.
Verification: Navigate between all Zone B workspaces and confirm Zone A content, scroll position, and selection state are unchanged.

**Pane A1 — Venue Selector behavior:**
- Clicking any venue navigates to `/venues/:venue_id`.
- The currently active venue (if Zone B shows a venue workspace) is highlighted.
- Venue state indicators update in real-time. Updates to venue indicators must not cause scroll position reset.
- VIEWER role: shows only assigned venues. OPERATOR and ADMIN: shows all venues with assignment indicators.

**Pane A2 — Incident List behavior:**
- Clicking any incident navigates to `/incidents/:incident_id`.
- Incidents are ordered by severity descending, then by declared_at descending.
- Resolved incidents are removed from the list within 60 seconds of resolution. They remain accessible via replay session links.
- The list shows a maximum of 20 incidents. If more than 20 are active simultaneously, a "View all incidents" link navigates to `/fleet` with the incident filter active.

**Pane A3 — Notification Tray:**
- Clicking the notification tray access opens the tray as an overlay on Zone A. This does not change Zone B.
- Each notification item includes a navigable link. Clicking the link navigates Zone B and closes the tray.
- Notifications are not a route — they are an in-Zone-A overlay.

**Pane A4 — Operator Tools:**
- Contains: Handoff initiation, session information, session elevation request, logout.
- These are operator session actions, not workspace navigation actions.
- Handoff initiation opens a modal overlay — it does not change Zone B or the current route.

### Contextual Navigation — Zone B

**CMS Tab Switching:**
Approved: Switching CMS tabs changes the URL (e.g., `/cms/schedule` to `/cms/overrides`) and adds a browser history entry.
Forbidden: Changing CMS tabs without updating the URL; updating the URL without adding a history entry.
Operational consequence: If tab switches do not produce history entries, the browser back button skips tabs and confuses operators who use back-navigation habitually.
Verification: Navigate through all 6 CMS tabs, confirm browser history contains 6 entries, confirm back-navigation steps through all tabs in reverse order.

**Replay Tab Switching:**
Approved: Switching the 6 Replay tabs updates the URL with a `?tab={tab-identifier}` query parameter. Valid tab identifiers: `pre-resolution-trace`, `state-machine`, `override-stack`, `corpus-evidence`, `divergence-comparison`, `counterfactual`.
Forbidden: Switching tabs without updating the query parameter; using numeric tab indexes in the URL (not stable across tab additions).
Operational consequence: A forensic investigator sharing a URL to a specific replay tab finding must be able to send that URL to a colleague. Numeric indexes break when tabs are reordered.
Verification: Navigate to each replay tab; copy URL; open URL in a new browser tab; confirm the correct tab is active.

**Incident Commander Sub-Zones:**
IC-TOP, IC-LEFT, IC-RIGHT, IC-BOTTOM are layout sub-zones, not navigable routes. Resizing, collapsing, or switching focus between IC sub-zones does not update the URL and does not add browser history entries. The IC sub-zone layout state may be persisted in `localStorage` keyed by operator_id and incident_id, but it is not a URL concern.

### Emergency Navigation

**EMERGENCY_FREEZE state:**

During `EMERGENCY_FREEZE`, navigation is restricted to the following permitted routes:

| Route | Permitted during EMERGENCY_FREEZE | Reason |
|---|---|---|
| `/venues/:venue_id` | Yes — read-only | Operators must be able to view venue state |
| `/incidents/:incident_id` | Yes — read-only | Incident monitoring must continue |
| `/venues/:venue_id/replay/:session_id` | Yes — REPLAY mode only | Forensic investigation permitted |
| `/fleet` | Yes — read-only | Fleet visibility required |
| `/cms/*` | No — blocked | Content changes prohibited during freeze |
| `/training/*` | No — blocked | Training suspended during constitutional emergency |

Approved: During EMERGENCY_FREEZE, CMS and Training navigation items in Zone A are visually disabled (not absent) with a tooltip: "Unavailable during Emergency Freeze." Clicking them does not navigate.
Forbidden: Removing CMS and Training from Zone A during EMERGENCY_FREEZE; silently failing navigation attempts without explanation.
Operational consequence: If navigation items are removed without explanation, operators assume a UI error and reload the page, potentially losing incident context.
Verification: Simulate EMERGENCY_FREEZE state; attempt to navigate to `/cms/schedule`; confirm the visual state of Zone A and confirm no navigation occurs.

**S1/S2 Active Incident:**

When an S1 or S2 incident is active for a venue the operator is currently viewing:
- Zone B is taken over by the Incident Commander Surface.
- The route changes to `/venues/:venue_id/incident/:incident_id` using a browser history push (not replace), so the operator can navigate back to the venue dashboard.
- The operator may navigate away from the IC surface. Doing so does not close the incident or relinquish command.
- Zone A continues to show the incident in Pane A2 with an active state indicator.
- If the operator is the current Incident Commander and navigates away, a banner appears in Zone B ("You are the active Incident Commander for [venue] — [Return to incident]") until they return.

Approved: The IC takeover is a navigation event (route change) that the operator can reverse using the browser back button or by clicking the incident in Zone A.
Forbidden: Rendering the IC surface as a modal or overlay that traps Zone B; preventing navigation away from the IC surface.
Operational consequence: Locking an operator in the IC surface prevents them from accessing venue dashboards or replay sessions that may be necessary for incident resolution.
Verification: Trigger an S1 incident; confirm route changes to IC URL; confirm browser back navigates to venue dashboard; confirm IC surface re-appears when navigating forward.

---

## URL Stability Contracts

### Stable Identifiers — Minimum Lifetime

| Route pattern | Minimum lifetime | Expiry behavior |
|---|---|---|
| `/venues/:venue_id` | Permanent | Venue decommission redirects to `/fleet` |
| `/incidents/:incident_id` | 7 years from incident closure | After expiry: redirect to `/not-found` with "Record retention period ended" |
| `/venues/:venue_id/incident/:incident_id` | 7 years from incident closure | Same as above |
| `/venues/:venue_id/replay/:session_id` | Lifetime of corpus record | Session archive redirects to `/venues/:venue_id/replay` with notice |

### Backwards-Compatible Redirects

If any route path is restructured, a redirect must be in place before the old path is removed. Redirect minimum duration: 12 months. Redirect must log a deprecation signal to the observability sink so engineering can identify callers still using the old path.

**Approved:** `/cms/venue-assignments` redirects 301 to `/cms/venues`
**Forbidden:** Removing `/cms/venue-assignments` without a redirect contract in place.
**Operational consequence:** External tooling, operator bookmarks, and automated notification links that reference old URLs break silently.
**Verification:** For every renamed route, write a redirect test that confirms the 301 response and the correct target URL.

### What May Change Without Redirect

- Query parameters within routes (tab identifiers, filter state) may be added, removed, or renamed without redirect contracts, because query parameters are navigational state, not durable identifiers.
- Zone C pane configuration (collapse state, pane order) is not in the URL and may change without impact.

---

## Route Persistence

### Page Reload (F5) Behavior

| Route category | Reload behavior |
|---|---|
| Stable identifier routes (`/venues/:id`, `/incidents/:id`, `/replay/:id`) | Route renders to the same workspace with the same entity loaded. All data is refetched from the server. |
| CMS tab routes (`/cms/schedule`) | CMS workspace renders with the correct tab active. |
| Replay session with tab (`/venues/:id/replay/:session_id?tab=corpus-evidence`) | Replay session loads; correct tab is active. |
| `/training/simulation` | Redirect to `/training` unless simulation session is persisted server-side. |
| `/cms` (no tab) | CMS renders; last active tab is restored from `localStorage` keyed by operator_id, or defaults to `/cms/schedule`. |
| `/` | Redirect to default destination (see redirect logic). |

**Reload contract:**
Approved: On reload, the application re-establishes all subscriptions and refetches all required data before rendering content. A loading state is shown during this period.
Forbidden: Using stale `localStorage` or `sessionStorage` data to render content before the server confirms it is current. Cached data may be used to render a skeleton or loading indicator only.
Operational consequence: If stale cached data is used as if it were current, operators may act on venue states or override stacks that have changed since their last session.
Verification: Load a route, modify the underlying data from a separate session, reload the original browser tab, confirm the updated data is displayed.

### Session Expiry Behavior

When a session expires during active use:
1. The application captures the current URL as the return URL.
2. The operator is redirected to `/login?return={encoded_current_url}`.
3. After re-authentication, the application redirects to the captured return URL.
4. If the re-authenticated session has insufficient authority for the return URL, redirect to the closest permitted route with an explanation.

Approved: Return URL is stored in the query parameter of the login URL, not in `sessionStorage`, so it survives tab closure.
Forbidden: Returning the operator to the application home (`/`) after re-authentication when a return URL is available.
Operational consequence: An operator mid-incident who loses their session must re-navigate to the incident after re-authentication. This creates latency during time-sensitive incident response.
Verification: Expire a session artificially; confirm the return URL is present in the login URL; authenticate; confirm redirect to the original route.

### Browser Back/Forward Behavior

| Navigation action | History entry | Browser back behavior |
|---|---|---|
| Navigate between workspaces via Zone A | Push | Returns to previous workspace |
| CMS tab switch | Push | Returns to previous CMS tab |
| Replay tab switch | Push (query param only) | Returns to previous replay tab |
| IC sub-zone switch | None | Back returns to route before IC was loaded |
| Zone C collapse/expand | None | Back returns to last route, not toggle state |
| Modal open/close (handoff, elevation) | None | Back returns to route, not to modal state |
| Notification tray open/close | None | Back returns to previous route |

**Rule NP-01: No spurious history entries**
Approved: History entries are added only on route changes and tab switches that change URL path or query parameters.
Forbidden: Adding history entries for UI state changes that are not reflected in the URL (panel collapse, modal open, tooltip display).
Operational consequence: Spurious history entries cause back-navigation to produce no visible change, confusing operators who rely on back to undo navigation.
Verification: Load a workspace; interact with Zone C collapse, modals, and tooltips; confirm history length matches only route and tab navigations.

---

## Default Route Redirect Logic

**`/` redirect rules (applied in order):**

1. If session is not authenticated → `/login`
2. If role is ADMIN → `/fleet`
3. If role is OPERATOR and assigned venues count > 1 → `/fleet`
4. If role is OPERATOR and assigned venues count == 1 → `/venues/{assigned_venue_id}`
5. If role is VIEWER → `/venues/{first_assigned_venue_id}` (alphabetical by venue name)
6. If role is VIEWER and no assigned venues → `/unauthorized` with "No venues assigned to your account — contact your administrator"

**Rule RD-01: Redirect is a server-computed decision**
The redirect target is computed from the session context object returned by the authentication endpoint. The frontend does not compute the redirect — it reads the `default_route` field from the session context.
Approved: `session.default_route` is present in the authentication response and the frontend navigates to it.
Forbidden: Frontend JavaScript computing the redirect target from role and venue count independently of the server.
Operational consequence: If the frontend computes the redirect, it may diverge from the server's view of venue assignment, producing a redirect to a venue the operator cannot access.
Verification: Test all 6 redirect cases with mock session objects; confirm the application navigates to the correct destination in each case.
