# Horizon

**Last updated**: 2026-06-23 | **Updated by**: Governance

This document holds open questions, ideas in flight, and architecture risks — things that are real and worth tracking but not yet resolved into DECISIONS.md or BACKLOG.md.

---

## Open Questions

### 🔴 Blocks next milestone

| # | Question | Context | Deadline |
|---|---|---|---|
| HQ-001 | When is first Pi 5 available for real venue deployment? | Everything that can be built without hardware is done. Pi enrollment, corpus delivery, layout rendering, heartbeat, and asset pre-download are all coded and tested in simulation. BL-F10 (TV playout scheduler), real heartbeat data in VenueDashboard, and proof-of-play logging all require a live Pi. This is the critical path to first paying venue. | — |
| HQ-002 | Will `COGNITO_SERVICE_KEY` be set on production? | AI "Write for me" and social publishing (cross-post to Facebook) are fully wired but gracefully skip when the key is blank. Shannon needs to get the key from the Cognito Guru GCF environment (`CLUBHUB_BRIDGE_API_KEY`) and add it to production `.env`. | — |

### 🟡 Emerging — next 1–2 milestones

| # | Question | Context |
|---|---|---|
| HQ-003 | When should real JWT auth replace the mock login? | CMS currently uses a stub `LoginPage` with mock auth. `MULTI_TENANT_ENFORCE=false` means the default tenant is used for all requests. Real operator SSO (BL-F01) is needed before any second operator organisation is onboarded. Should be scoped once the first venue is live on hardware. |
| HQ-004 | Who connects social accounts in Cognito UI per venue? | Before `social_schedule` can post for a venue, an operator must complete OAuth in Cognito UI (Settings → Social Connections). This is a one-time per-venue action. Needs a clear onboarding workflow — does Shannon do this during venue setup, or does the venue operator do it themselves? |
| HQ-005 | What is the OTA / player update delivery strategy for real Pi fleet? | The OTA pipeline (plugins/ota-runtime) exists in code but has never been tested against real hardware. When the first Pi is deployed, what triggers a player-ui update push? Who authorises it? Is there a staging Pi before pushing to production screens? |

### 🔵 Future bets — no urgency, worth tracking

| # | Question | Context |
|---|---|---|
| HQ-006 | Should card templates support per-tenant visual themes (CSS variable overrides)? | D-019 explicitly defers per-tenant themes. If multiple pub groups onboard, brand consistency per group (colour palette, font) becomes important. Scope only after 2+ tenants are live. |
| HQ-007 | Weather widget — which API, and who pays for it? | `weather` is a known future widget in D-017. OpenWeatherMap free tier is rate-limited. Needs a decision on API key ownership before scoping. |
| HQ-008 | Should BL-F08 (server-side WebP conversion) block image-heavy campaigns? | Currently images uploaded via Bunny are raw files (HEIC/JPEG from phones). Pi 5 can handle most formats in Chromium but file sizes could be large. Trigger: first venue reporting slow asset sync or large corpus. |

---

## Ideas in Flight

Ideas raised in freeflow sessions — not yet promoted to BACKLOG or DECISIONS.

| ID | Idea | Raised by | Date | Status |
|---|---|---|---|---|
| HZ-001 | GBP (Google Business Profile) posting via Cognito bridge | Shannon | 2026-06-20 | Waiting — 501 stub in `clubhub-bridge`. Scoped when Cognito GBP GCF is ready. |
| HZ-002 | LateAPI multi-platform (Instagram, LinkedIn) | Shannon | 2026-06-20 | Parked — social_jobs schema accepts `platform` array, bridge supports `platforms[]`. UI only sends `['facebook']` for now. Wire additional platforms when accounts are connected. |
| HZ-003 | Sponsored ticker — attribution alongside ticker text | Shannon | 2026-06-20 | Parked — `sponsored_ticker` widget noted in D-017 as future. Needs design decision on how sponsor name displays alongside scrolling text. |
| HZ-004 | Countdown widget | Session | 2026-06-20 | Noted in D-017. Config: `{ target_datetime, label }`. Scope when Layout Builder + Widget Gallery are proven on real hardware. |

---

## Architecture Risks

Known design choices that may need revisiting as the system scales.

| Risk | Trigger | Mitigation |
|---|---|---|
| pg Pool max=10 | ≥ 100 enrolled screens sending concurrent heartbeats | BL-F04 already scoped. Bump pool size + add read replica if needed. |
| Git history divergence (production vs local) | Production server commits directly; local monorepo has separate history. A `git pull` on the server from GitHub would work but local and production branches can't be cleanly merged. | Accept divergence for now — production is the source of truth. Consider setting up a proper CI/CD push pipeline (GitHub Actions → SSH deploy) to eliminate direct server commits. |
| Single-backend SPOF | No load balancer. PM2 restarts on crash but there's a window. | Acceptable for early venue deployments. HA only needed at ~10+ venues. xCloud supports vertical scaling. |
| MULTI_TENANT_ENFORCE=false | All requests use default tenant. A second operator org onboarded before JWT auth is live would see all data. | BL-F01 (real JWT auth) must be done before onboarding a second tenant. Flag if Shannon mentions a second client. |
| Bunny CDN dependency for media | If Bunny is down, new media uploads fail. Pi plays from local cache so existing content is safe. | Pi asset-manager pre-downloads all `media_url` assets — 72h autonomy preserved. Upload failures surface in CMS as errors. Acceptable. |

---

## Horizon Session Log

| Date | Mode | Triggered by | Key outputs |
|---|---|---|---|
| 2026-06-20 | Architecture | Shannon: Cognito Guru integration decision | D-020 filed; BL-045/046/047 scoped and completed |
| 2026-06-20 | Architecture | Shannon: layout authoring requirement | D-015 revisited; BL-048 (Dynamic Layout Builder) scoped and completed |
| 2026-06-23 | Governance | Orient session — stale PROJECT_STATE | PROJECT_STATE + HORIZON updated; open questions catalogued |
