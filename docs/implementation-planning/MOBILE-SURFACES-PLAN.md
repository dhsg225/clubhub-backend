# Mobile Surfaces Implementation Plan

**Surfaces:** Progressive Web Apps for venue operators and marshals
**Audiences:** VENUE_OPERATOR, REGIONAL_MANAGER, golf course marshals
**Status:** Implementation-ready engineering specification

---

## 1. Technology Decision: PWA (not React Native)

**Decision:** Progressive Web App (PWA) for all mobile surfaces.

**Rationale:**

1. **No App Store dependency.** B2B operator apps distributed through App Store / Play Store introduce publishing delays, review friction, and update cadence mismatches with the backend. A golf course marshal cannot wait 48 hours for an emergency trigger fix to clear App Store review. PWA distribution is immediate.

2. **Installable to home screen.** PWAs can be added to the iOS and Android home screen. From the operator's perspective, it functions like a native app. Operators do not need to understand what a PWA is.

3. **Single codebase.** The PWA runs on iOS Safari, Android Chrome, and any modern mobile browser. React Native requires a native bridge and separate build pipelines per platform.

4. **Offline capability via Service Worker.** Service Worker gives precise control over what is cached and what requires network — critical for the golf marshal surface, which must work on poor mobile data.

5. **No API surface change.** The mobile PWA uses the same REST API and WebSocket as the web application. No separate mobile-specific API layer required.

**Limitations accepted:**

- Push notifications on iOS require iOS 16.4+ (PWA installed to home screen). Older iOS: no push notifications; alerts are in-app only. This is acceptable for v1.
- No access to native device APIs that require native code (biometric auth, NFC, Bluetooth). Not required for v1 scope.
- Haptic feedback: available in some browsers via Vibration API (`navigator.vibrate()`); not universally supported. Use where available, do not depend on it.

---

## 2. Surface 1: Venue Manager App

**Target users:** VENUE_OPERATOR, REGIONAL_MANAGER
**Primary use cases:** emergency trigger, screen status check, override management, entropy alert review, shift handover

### 2.1 Technical Stack

Same core as `cms-web`:
- React 18 + TypeScript
- TanStack Query v5
- Zustand
- Tailwind CSS (same design conventions — functional, no decoration)
- Vite PWA plugin (`vite-plugin-pwa`) — generates Service Worker and Web App Manifest

This is a separate Vite entry point, not a separate repository. It shares the API client, type definitions, and authentication logic with `cms-web`. The UI layer is purpose-built for mobile context.

### 2.2 PWA Manifest

```json
{
  "name": "ClubHub Venue Manager",
  "short_name": "ClubHub",
  "description": "Venue management for ClubHub TV operators",
  "start_url": "/mobile/",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 2.3 Service Worker Caching Strategy

```typescript
// vite-plugin-pwa workbox configuration

{
  runtimeCaching: [
    {
      // API responses: network first, short cache fallback
      urlPattern: /\/api\/v2\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxAgeSeconds: 60 }, // 1 minute stale API data is acceptable
      },
    },
    {
      // Static assets: cache first
      urlPattern: /\.(js|css|png|svg)$/,
      handler: 'CacheFirst',
      options: { cacheName: 'static-cache', expiration: { maxAgeSeconds: 86400 } },
    },
  ],
}
```

Emergency trigger API calls (`/api/v2/emergency/*`) must NOT be cached — always network-only:

```typescript
{
  urlPattern: /\/api\/v2\/emergency\//,
  handler: 'NetworkOnly',
}
```

### 2.4 Navigation Structure

The mobile navigation is a bottom tab bar with 4 tabs (appropriate for thumb reach):

```
┌──────────────────────────────────┐
│  [Home]  [Screens]  [Emergency]  │
│                    [Alerts]      │
└──────────────────────────────────┘
```

**Home tab:** Venue dashboard — overview of active emergencies, screen status summary, pending entropy alerts, current constitutional state.

**Screens tab:** Screen list — online/offline status, last seen, entropy warnings per screen. Tap for screen detail (last resolved playlist, sync status).

**Emergency tab:** Emergency console — HIGHEST PRIORITY. Always accessible in two taps from any screen. See Section 2.5.

**Alerts tab:** Entropy alerts, circuit breaker events, system notifications. Sorted by severity.

The "Emergency" tab uses a red background and white icon even when no emergency is active — it must always be visually prominent and never look like an inactive feature.

### 2.5 Emergency Trigger Mobile Flow

The emergency trigger must be accessible within 2 taps from any screen in the app:
- Tap 1: Any tab → tap the Emergency tab
- Tap 2: Tap "Trigger Emergency" button

The flow itself is two steps:

**Step 1 — Emergency Type (full screen):**
- Title: "Trigger Emergency"
- Four large tap target buttons (minimum 64px height, full width):
  - VENUE_EMERGENCY
  - COMPLIANCE
  - EQUIPMENT_FAILURE
  - OTHER
- COMPLIANCE selection: note field appears immediately below (required, minimum 20 chars)
- OTHER selection: note field appears (required, minimum 10 chars)
- Large "Continue" button at bottom (disabled until selection made and required note entered)

**Step 2 — Confirmation (full screen, different background color):**
- Background: `bg-red-950` — visually distinct from step 1
- Title: "Confirm Emergency"
- Shows: "This will activate emergency content on [n] screens at [Venue Name]"
- Shows: Selected emergency type
- Shows: Note (if entered)
- Shows: current time
- LARGE RED BUTTON: "TRIGGER EMERGENCY" — full width, 72px height minimum
- Small "Cancel" text link below the button
- On confirm: POST `/api/v2/emergency/trigger`
- Haptic feedback on button press: `navigator.vibrate([100, 50, 200])`

**Success state:**
- Full screen green confirmation: "Emergency active"
- Shows: number of affected screens, venue name, time triggered
- "View emergency status" link to emergency detail

This flow is identical in structure to the web emergency trigger — same two-step, full-page, no dialog.

### 2.6 Override Management

VENUE_OPERATOR can view and cancel active overrides. Cannot create overrides on mobile v1 (scoped out — creation requires schedule preview that does not translate well to mobile).

- Tap override to see details: level, content, effective time, expiry
- "Cancel Override" button: requires single confirmation tap (not two-step, because override cancellation has lower blast radius than emergency trigger)

### 2.7 Entropy Alert Review

- List of entropy alerts sorted by severity (CRITICAL, WARNING, INFO)
- Tap to view: affected screens, asset checksums, drift duration
- "Acknowledge" action: requires entering an acknowledgment note (short text field, min 10 chars)
- No auto-acknowledge button

### 2.8 Shift Handover Report

VENUE_OPERATOR can generate a shift handover report:
- Tap "Generate Handover Report"
- System generates: active emergencies, pending alerts, override status, screen health summary
- Report shows on screen and can be shared via native share API (`navigator.share()`)
- The report is a read-only summary — no state mutations from the handover flow

---

## 3. Surface 2: Golf Marshal Lightning Warning App

This is a distinct product surface from the venue manager app. It is a stripped-down PWA with a single purpose: trigger a lightning warning for the golf course.

### 3.1 Why Separate

The golf marshal needs:
- Maximum simplicity (one action, large UI, no navigation)
- No login friction during an active storm
- Pre-authenticated session that survives for a shift duration (8 hours)
- Reliable on poor mobile data at the edge of a golf course

The venue manager app has too much navigation and complexity for this use case. A marshal reaching for their phone in a storm must not hunt for the emergency trigger.

### 3.2 Technical Stack

Static HTML + minimal JavaScript. Not a React app.

Rationale: the simpler the app, the less can fail. This app has one button. It does not need a component framework.

```
marshal-app/
  index.html      -- the entire app
  manifest.json   -- PWA manifest
  sw.js           -- service worker (hand-written, not generated)
  icon-192.png
  icon-512.png
```

### 3.3 Pre-Authentication

The marshal receives a URL with a session token embedded:
```
https://cms.clubhub.tv/marshal/?token=eyJhbGci...
```

On first load, the token is stored in a cookie (session-scoped, not localStorage):
```javascript
document.cookie = `marshal_token=${token}; max-age=28800; Secure; SameSite=Strict`;
// max-age=28800 = 8 hours
```

After token storage, the URL is cleaned (token removed from URL bar) and the full-screen button is shown.

On subsequent loads (within 8 hours), the cookie is present and the button is shown immediately — no login screen.

After 8 hours, the cookie expires and the marshal sees a "Session expired — contact your venue manager" message. No automatic re-login flow.

### 3.4 Single-Screen UI

```html
<!-- The entire visual UI -->
<div id="app">
  <div id="venue-name">Pinehurst Resort — Course 2</div>
  <button id="trigger-btn" onclick="showConfirm()">
    TRIGGER LIGHTNING WARNING
  </button>
  <div id="status" class="hidden"></div>
</div>

<div id="confirm-screen" class="hidden">
  <p>Activate lightning warning for all screens at<br>
  <strong>Pinehurst Resort — Course 2</strong>?</p>
  <button id="confirm-btn" onclick="triggerWarning()">CONFIRM</button>
  <button id="cancel-btn" onclick="hideConfirm()">Cancel</button>
</div>
```

Styles: large red button, full viewport height layout, high contrast white on dark red background. No navigation, no headers, no chrome.

### 3.5 API Call

```javascript
async function triggerWarning() {
  const response = await fetch('/api/v2/emergency/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `marshal_token=${getCookieValue('marshal_token')}`,
    },
    body: JSON.stringify({
      type: 'COMPLIANCE',
      note: 'Lightning warning — course marshal',
      venue_id: VENUE_ID,  // embedded at build time per venue
    }),
  });
  // ... handle success/failure
}
```

### 3.6 Offline Behavior

The Service Worker caches `index.html`, `manifest.json`, and `sw.js` on first load. If the marshal has no network:

- The app UI is still shown (from cache)
- The trigger button is still shown
- On tap: the app attempts the API call
- If the call fails: show "Unable to reach ClubHub server. Try again or contact venue manager."

The app cannot trigger the emergency offline — it requires a network call to the CMS. This is correct behavior: an offline emergency trigger with no server confirmation would be worse than no trigger (the screens would not actually activate emergency content). The marshal must use an offline backup procedure (documented separately in operational runbooks).

### 3.7 Deployment

The marshal app is a separate Vite build (or static file set) deployed alongside the main application. A unique URL is generated per venue per season with the appropriate `VENUE_ID` embedded at build time or as a URL parameter baked into the manifest.

---

## 4. Surface 3: Read-Only Monitoring (REGIONAL_MANAGER)

### 4.1 Scope

REGIONAL_MANAGER using mobile for situational awareness only. No mutation capability. This surface is a subset of the venue manager app — it is not a separate application; it is a view mode for REGIONAL_MANAGER within the same PWA.

### 4.2 What Regional Managers See on Mobile

**Home screen (fleet view for their region):**
- Per-venue health summary: HEALTHY / DEGRADED / EMERGENCY (badge)
- Active emergency count per venue
- Critical entropy alert count
- Constitutional state (if not HEALTHY)

**Push notifications (via Web Push API):**

Topics the REGIONAL_MANAGER subscribes to:
- `entropy.critical.{venueId}` — CRITICAL entropy alert triggered
- `circuit_breaker.open.{enterpriseId}` — any circuit breaker enters OPEN state
- `emergency.active.{venueId}` — emergency triggered in their region

Notification format:
```
Title: "CRITICAL: Entropy alert — The Grand Hotel"
Body: "5 screens with asset drift detected. Review required."
[Tap to open] → venue entropy view
```

**No mutation capability from monitoring view.** REGIONAL_MANAGER on mobile cannot trigger emergencies (they can on the full venue manager view, but the read-only monitoring mode is for passive oversight). If REGIONAL_MANAGER needs to take action, they open the full app.

### 4.3 Push Notification Implementation

```typescript
// Push subscription setup (runs after PWA install prompt accepted)

async function subscribeToPushNotifications(role: Role, venueIds: string[]) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  // POST subscription to CMS — server stores and uses for push delivery
  await fetch('/api/v2/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      subscription,
      role,
      venue_ids: venueIds,
      topics: getTopicsForRole(role, venueIds),
    }),
  });
}
```

### 4.4 Service Worker Push Handler

```javascript
// sw.js — handles push events
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.action_url },
      tag: data.deduplication_tag, // prevents duplicate notifications
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

---

## 5. Explicit v1 Out of Scope

The following are explicitly excluded from mobile v1. Including them would increase scope without proportional operator value.

| Feature | Why Excluded |
|---|---|
| Campaign creation on mobile | Requires preview subsystem; preview UX doesn't translate to mobile well |
| Canary promotion from mobile | FLEET_WIDE decisions require ENTERPRISE_ADMIN at a desk with full data context |
| Constitutional controls (PLATFORM_ADMIN console) | PLATFORM_ADMIN actions require careful review; mobile is wrong surface |
| Sponsor portal mobile | SPONSOR_STAKEHOLDER is low-priority for mobile; proof-of-play review is a desktop task |
| Offline emergency trigger (without server confirmation) | Cannot guarantee emergency content activates; more dangerous than no trigger |
| Bulk override management | Mobile is for reactive actions, not bulk management |

---

## 6. Install Flow

On first visit from a supported mobile browser, show the install prompt after the user has successfully performed one action (not immediately on load):

```typescript
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show prompt after first successful login
  onFirstSuccessfulLogin(() => {
    showInstallBanner();
  });
});

function showInstallBanner() {
  // Banner: "Add ClubHub to your home screen for faster access to emergency controls"
  // [Add to Home Screen] [Not now]
}
```

For iOS Safari (which does not fire `beforeinstallprompt`): show a manual install guide banner with instructions (tap Share → Add to Home Screen) after first successful login.

---

## 7. Open Items

1. iOS push notification version requirement — confirm minimum iOS version for venue managers; if older iOS devices are common in the field, push notifications may not be available for a significant portion of users
2. Marshal app token delivery mechanism — currently specified as URL with embedded token; need to define the secure distribution process (how does the venue manager generate and share the URL with the marshal at the start of season?)
3. Offline backup procedure for marshal emergency trigger — the app cannot trigger offline; what is the documented fallback? This is an operational runbook item but the app UI should reference it
4. Regional manager venue scope at login — how many venues can a REGIONAL_MANAGER be responsible for? If hundreds, the fleet view needs virtual scrolling
5. Web Push on corporate iOS devices — some enterprise MDM configurations restrict Web Push even on iOS 16.4+; this is a known deployment risk
