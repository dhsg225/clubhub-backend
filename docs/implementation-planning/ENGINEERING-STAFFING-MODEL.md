# ENGINEERING-STAFFING-MODEL.md

**Document type:** Engineering implementation planning
**Status:** Engineering-ready
**Authority:** IMPLEMENTATION-WAVES.md, CRITICAL-PATH-ANALYSIS.md
**Last updated:** 2026-05-26

---

## Overview

This document defines realistic staffing assumptions for delivering all 7 implementation waves in 52 weeks. It covers the minimum viable team, constitutional stewardship requirements, role-specific responsibilities by wave, and concrete risk mitigations for bus-factor and expertise concentration problems.

All headcounts are for dedicated engineers. Part-time or shared engineers are not assumed — shared engineers consistently underestimate load from context-switching and are not reliable for critical path items.

---

## Minimum Viable Team

**9 engineers total for all 7 waves in 52 weeks.**

This is not a comfortable team size — it is the minimum that can realistically deliver the constitutional requirements without shortcuts. Going below 9 engineers is possible only by deferring non-critical-path items and accepting schedule risk on critical-path items.

| Role | Count | Waves active | Primary responsibility |
|---|---|---|---|
| Technical Lead | 1 | Waves 1–7 | Constitutional architecture stewardship, cross-service design review, critical path unblocking |
| Backend Engineer | 3 | Waves 1–7 | CMS API, replay audit service, entropy service, corpus publisher, shadow service, canary service |
| Edge Engineer | 1 | Waves 1–4 | player-runtime, player-ui, corpus sync, Pi deployment tooling |
| Frontend Engineer | 2 | Waves 1–7 | cms-web (all versions), sponsor-portal, preview UX, entropy UX, shadow/canary UX |
| Mobile Engineer | 1 | Waves 4–7 | Mobile PWA, golf marshal surface, conference zone UX |
| DevOps / Platform | 1 | Waves 1–7 | PostgreSQL, Redis, CDN, CI/CD, signing infrastructure, OTel pipeline, Grafana, DR |

**Total: 9 engineers**

---

## Role Descriptions and Responsibilities

### Technical Lead (1, all waves)

The Technical Lead is not a manager — they are a working engineer who also holds constitutional authority. They write code, but they are the final decision-maker on any change that touches:

- `src/pre/`, `src/runtime/`, `src/shadow/`, `src/audit/`, `src/entropy/` (the constitutional substrate)
- CI enforcement stages (ci/stages/)
- Corpus signing infrastructure
- Canary stage advancement configuration
- Circuit breaker configuration
- Any proposal to treat a constitutional shortcut as permanent
- Any proposal to weaken append-only enforcement, even temporarily

**Constitutional stewardship duties (recurring, all waves):**
- Review all PRs that touch files in `src/` — blocks merge if constitutional boundary is violated
- Run `constitutional-boundary-check.ts` manually on every release candidate (in addition to CI)
- Chairs the corpus signing ceremony (Wave 2) and any key rotation events
- Approves all database migrations that touch append-only tables or partition schemas
- Writes or approves the architectural section of each wave's post-implementation review

**Wave-specific responsibilities:**
- Wave 1: design the corpus sync protocol and the local audit ring buffer specification (edge engineer implements; Technical Lead reviews and approves)
- Wave 2: leads the corpus signing ceremony; reviews all RLS policies before they go to production
- Wave 3: approves the campaign state machine implementation; verifies emergency trigger is reachable in 2 actions
- Wave 4: approves the preview API design; verifies the `PREVIEW:` checksum prefix enforcement
- Wave 5: reviews the entropy metric calculators against `src/entropy/` definitions
- Wave 6: issues and manages human approval tokens for canary stage advancement in staging; reviews shadow service parity storage design
- Wave 7: authorizes EMERGENCY_FREEZE exit wizard design; reviews DR plan before drill

**What the Technical Lead does NOT do:**
- Does not own project management or sprint planning (that is a separate function)
- Does not approve business requirements (that is the product owner / operator)
- Does not approve PLATFORM_ADMIN console UX (that is the frontend lead)
- Does not issue human approval tokens for production canary advancement (that is PLATFORM_ADMIN's authority — the Technical Lead issues them in staging/testing only)

---

### Backend Engineer (3, all waves)

Three backend engineers share responsibility across all cloud services. The work is distributed as follows (not fixed — can shift based on wave demands):

**BE-1 (primary: CMS API + auth service):**
- Waves 1–3: CMS API CRUD, auth service, campaign lifecycle, override management, emergency system cloud side
- Wave 4+: maintains CMS API, adds endpoints for entropy alert inbox, shadow status views

**BE-2 (primary: replay audit + corpus publisher):**
- Wave 2: replay-audit-api (POST /audit/batch, integrity endpoint, chain verification)
- Wave 3: corpus publication pipeline (corpus assembly, signing, CDN delivery)
- Wave 4+: proof-of-play report generation, preview API (in collaboration with BE-3)

**BE-3 (primary: entropy, shadow, canary — added in Wave 2 as the +1):**
- Wave 2: joins as the additional backend engineer
- Wave 3: entropy service basic (report receiver + storage)
- Wave 5: entropy score computation, fleet scanning, alert routing
- Wave 6: shadow service, canary service
- Wave 7: post-incident review workflow, training certification service

**Shared responsibilities (all BE engineers):**
- Database migration files (reviewed by Technical Lead before merge)
- API contract documentation (OpenAPI specs maintained in the repository)
- Unit and integration test coverage (minimum 80% line coverage on all CMS API endpoints)
- Participate in on-call rotation starting Wave 3 (one BE engineer on-call per week in rotation)

---

### Edge Engineer (1, Waves 1–4)

The edge engineer owns everything that runs on the Raspberry Pi. This is a specialized role — the engineer must be comfortable with:
- Node.js process management on Linux (systemd units, process supervision)
- Chromium kiosk configuration on Raspberry Pi OS
- Network programming (WebSocket, long-poll, retry logic, network interruption handling)
- File system operations on resource-constrained hardware (SD card write endurance, atomic file replacement)
- The constitutional runtime substrate (`src/pre/`, `src/runtime/`) — the edge engineer must understand the constitutional contracts even if they do not modify these files

**Wave 1:** player-runtime v1 (PRE loop, corpus sync, heartbeat, local audit buffer), player-ui v1, systemd unit file, kiosk launcher script, Pi setup documentation

**Wave 2:** Add corpus signature verification to corpus sync; add audit batch delivery to replay-audit-api; verify async behavior of audit sync does not block the PRE loop

**Wave 3:** Add emergency WebSocket subscription; add `POST /entropy/report` delivery to entropy-service; handle emergency signal delivery to player-ui; verify 72h corpus validity window enforced locally

**Wave 4:** Add PRECircuitBreaker and ReplayCircuitBreaker wrappers; 72h offline autonomy test; GRADE_A venue local CMS node support; audit async batch (non-blocking background send)

**After Wave 4:** The edge engineer's workload decreases significantly. At this point, either:
- The edge engineer transitions to a backend role and works on the entropy service or shadow service
- The edge engineer focuses on edge fleet management tooling (OTA updates for player-runtime, Pi fleet provisioning scripts)
- The edge engineer is the on-call contact for all player-runtime production issues

**Pairing requirement:** Due to the bus-factor risk (see Staffing Risks), every significant edge engineering session (corpus sync, audit ring buffer, circuit breaker integration) must be paired with a backend engineer or the Technical Lead. The intent is to create a second person who understands the edge codebase deeply enough to debug production issues without the edge engineer's presence.

---

### Frontend Engineer (2, Waves 1–7)

Two frontend engineers split cms-web and the other operator-facing surfaces.

**FE-1 (primary: cms-web):**
- Wave 1: cms-web shell (auth, routing, venue dashboard read-only)
- Wave 2: audit query UI (AUDITOR role view)
- Wave 3: campaign manager, schedule editor, override console, emergency console (full CMS v2)
- Wave 4: preview panel, preview confirmation gate, approval workflow UX
- Wave 5: entropy inbox, acknowledgment workflow, fleet health dashboard integration
- Wave 6: parity dashboard, canary advancement wizard, sponsor portal

**FE-2 (primary: remaining surfaces):**
- Wave 1: player-ui v1 (playlist renderer, emergency overlay)
- Wave 3: CMS web v2 secondary screens (screen detail, deployment group management, sponsorship management)
- Wave 4: mobile PWA v1 (emergency trigger, screen status, entropy alerts)
- Wave 5: Grafana dashboard coordination (not Grafana itself — FE-2 owns the OTel metric definitions that feed the dashboards)
- Wave 6: sponsor portal (proof-of-play, preview)
- Wave 7: golf marshal PWA, conference zone UX, shift handover report

**Shared frontend responsibilities:**
- Design system (shared component library used by cms-web, sponsor-portal, player-ui)
- Accessibility compliance (WCAG 2.1 AA minimum)
- Test coverage: React Testing Library unit tests on all components; Playwright end-to-end tests for all critical workflows (emergency trigger, campaign approval, canary advancement)
- TypeScript strict mode enforced

---

### Mobile Engineer (1, Waves 4–7)

The mobile engineer joins in Wave 4 when the mobile PWA is required.

**Wave 4:** Mobile PWA v1 — React PWA with Service Worker. Emergency trigger (VENUE_OPERATOR), screen status list, entropy CRITICAL push notifications. iOS Safari and Android Chrome tested.

**Wave 7:** Golf marshal PWA (specialized interface with lightning warning one-tap trigger, hole-by-hole screen map). Conference zone content UX (optional — may be deferred to the two frontend engineers if Wave 7 scope is constrained).

**Note:** The mobile engineer may also handle the progressive enhancement of cms-web for tablet use (VENUE_OPERATOR accessing cms-web on a tablet is a documented use case). This work does not require a separate PWA — it requires the cms-web responsive layout to be verified and tested on iOS Safari 14+.

---

### DevOps / Platform Engineer (1, all waves)

The platform engineer owns all infrastructure — cloud and edge.

**Wave 1:** PostgreSQL 15+ (RDS or self-managed), Redis (ElastiCache or self-managed), Docker Compose for local development, GitHub Actions CI pipeline, staging environment setup, environment variable management (AWS Secrets Manager or Vault), initial CDN configuration for corpus distribution

**Wave 2:** Corpus signing infrastructure (AWS KMS key pair, CI integration to sign during corpus-publisher build), RLS verification tests in CI, monthly partition creation job for `replay_audit_records`

**Wave 3:** WebSocket gateway (for emergency push channel), object storage configuration (S3 + CloudFront for corpus CDN), corpus CDN cache headers (long TTL on version_id-addressed resources)

**Wave 4:** WebSocket gateway scaling (if fleet > 100 players, the WebSocket gateway needs horizontal scaling with Redis pub/sub fan-out), player-runtime OTA update tooling (how do we update the player-runtime binary on deployed Pis without physical access?)

**Wave 5:** OpenTelemetry pipeline (OTel Collector → Prometheus → Grafana), Jaeger or AWS X-Ray setup, Grafana dashboard deployment, alert routing infrastructure (PagerDuty or equivalent for CRITICAL alerts), structured log aggregation (CloudWatch Logs, Loki, or equivalent)

**Wave 6:** Shadow service infrastructure (low-traffic service, can share infrastructure with canary service)

**Wave 7:** Disaster recovery drill execution (RDS failover, service reconnection verification), multi-region discovery (architecture document + cost estimate, no implementation)

**Ongoing:** Monthly partition maintenance (create next 3 months of partitions for `replay_audit_records`), certificate rotation, dependency security updates (Dependabot or equivalent), performance monitoring

---

## Constitutional Stewardship Requirement

**The Technical Lead must have full constitutional architecture knowledge.** This is not negotiable and cannot be delegated.

The Technical Lead is the gatekeeper for any change to the constitutional substrate. If the Technical Lead is absent (vacation, illness, departure), the following actions are blocked until they return or a qualified designee is formally designated:

- Any PR that modifies `src/pre/`, `src/runtime/`, `src/shadow/`, `src/audit/`, `src/entropy/`
- Any database migration touching append-only tables or their triggers
- Corpus signing key rotation
- Canary stage advancement configuration changes
- Any proposal to defer or weaken a constitutional requirement

**Constitutional onboarding requirement (Wave 1):**

All 9 engineers must complete constitutional onboarding in Wave 1, before writing production code. Constitutional onboarding consists of:

1. Reading `ENGINEERING-CONSTITUTION-v1.md` in full
2. Reading `EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md` in full
3. Running the full test suite locally: `tsc --noEmit`, `validate-contracts.ts --all`, `verify-corpus-integrity.ts`, level vectors, replay harness, hardening vectors
4. Passing a constitutional quiz (10 questions, administered by Technical Lead) — no passing score required, but questions reveal whether the engineer understands constitutional boundaries
5. Pairing with the Technical Lead to trace one PRE.resolve() invocation end-to-end from corpus input to audit record output

The constitutional onboarding is not bureaucratic ceremony. Engineers who do not understand the constitutional boundaries make decisions that violate them — not from malice but from not understanding why the boundary exists. The boundary between PRE and CMS is not obvious to someone who has not read the constitution.

---

## Staffing Risks

### Risk 1: Single Edge Engineer — Bus Factor 1

**Current state:** One edge engineer owns player-runtime, player-ui, corpus sync, audit ring buffer, circuit breaker integration, Pi deployment tooling, and kiosk configuration. If this engineer is unavailable for 2+ weeks (illness, departure), the edge codebase becomes effectively unmaintainable by the remaining team.

**Consequences of bus factor failure:**
- Production incidents on the Pi fleet cannot be diagnosed
- Wave 4 player-hardening work halts
- 72h offline autonomy test cannot be run
- Pi OTA updates cannot be deployed

**Mitigations:**
1. **Mandatory pairing:** All significant edge sessions (corpus sync, audit ring buffer, circuit breaker integration) must be paired. At least one backend engineer or the Technical Lead must pair on every substantial edge feature.
2. **Early documentation:** Edge documentation (player-runtime README, Pi setup guide, corpus sync protocol, audit ring buffer design) must be written by the end of Wave 1 — not deferred to later.
3. **Second engineer familiarization:** By Week 6, designate one backend engineer as the secondary edge contact. That engineer must be able to SSH into a Pi, read the player-runtime logs, identify the current corpus version, and restart the player-runtime process.
4. **Test harness coverage:** Edge code must have unit tests runnable without Pi hardware. The corpus sync, audit ring buffer, and circuit breaker logic must be testable with a mock file system and mock network.

---

### Risk 2: Constitutional Expertise Concentration

**Current state:** The Technical Lead holds the constitutional architecture knowledge. If the Technical Lead departs in Wave 3 or later, no one else has the depth to confidently review constitutional boundary PRs.

**Consequences:** Engineers start making pragmatic decisions that weaken constitutional guarantees — not intentionally, but because they don't know which shortcuts are safe and which are not. This is the most dangerous long-term risk because the damage accumulates silently.

**Mitigations:**
1. **Constitutional onboarding for all engineers** (mandatory, Wave 1 — see above).
2. **Designate a constitutional deputy in Wave 2.** One of the three backend engineers should be designated as the constitutional deputy — they review the same PRs as the Technical Lead (in parallel, not as a gatekeeper). This engineer becomes qualified to act as Technical Lead if needed.
3. **The constitutional quiz is re-administered every 6 months.** New engineers and engineers who have been on unrelated work for >3 months take the quiz again. The intent is to refresh awareness of boundaries, not to test.
4. **Constitutional violations are public.** When `constitutional-boundary-check.ts` fails in CI, the failure is announced in the team channel with context explaining why the violation occurred and what the correct approach is. Violations are treated as learning opportunities, not performance issues.

---

### Risk 3: Single DevOps Engineer — Infrastructure Concentration

**Current state:** One DevOps engineer owns PostgreSQL, Redis, CDN, CI, signing infrastructure, OTel pipeline, and DR. This is a high concentration of critical infrastructure knowledge.

**Consequences of bus factor failure:**
- Database migrations cannot be safely applied
- Corpus signing infrastructure cannot be rotated or recovered
- Production incidents requiring infrastructure changes cannot be resolved

**Mitigations:**
1. **Technical Lead reviews all migrations.** The Technical Lead is the secondary reviewer for every database migration — not just the DevOps engineer.
2. **Runbooks for all critical operations.** The DevOps engineer must write runbooks (in `docs/operations/` or equivalent) for: PostgreSQL failover, corpus signing key rotation, partition creation and archival, Redis failure recovery, and CDN cache invalidation. Runbooks must be written by Wave 2 end.
3. **Infrastructure-as-code from day 1.** All infrastructure (PostgreSQL configuration, Redis configuration, CDN rules, signing key setup) must be defined in Terraform or equivalent. A second engineer must be able to apply the Terraform configuration from scratch in a new environment without the DevOps engineer's assistance.

---

## Phase-Specific Staffing Adjustments

### Wave 6: Temporary Backend Addition

Wave 6 (shadow governance) is the most complex backend wave. It requires implementing two new services (shadow service, canary service) with append-only storage, append-only enforcement triggers, and complex multi-step human approval workflows. The existing 3-backend team is fully loaded by CMS API maintenance and corpus-publisher work.

**Recommendation:** Add 1 temporary backend engineer for Waves 6–7 (20 weeks). Total backend team becomes 4 during this period.

This engineer's primary Wave 6 responsibility is the canary service (stage machine, promotion readiness evaluation, human approval token flow). Shadow service can be built by BE-3 (who has entropy service context and can extend into shadow territory).

### Wave 7: Shift Toward Operations

Wave 7 reduces engineering complexity (no new constitutional systems) and increases operational complexity (second enterprise onboarding, DR drill, on-call setup). The team composition shifts:

- Reduce backend team to 2 (BE-1 on CMS API maintenance; BE-3 on Wave 7 features: training certification, post-incident review, shift handover)
- BE-2 shifts to operations support: proof-of-play report troubleshooting, audit chain integrity monitoring
- Add 1 customer success engineer for the second enterprise onboarding workflow (not a software engineer — a technical account manager who can coordinate the onboarding checklist with the enterprise client)

---

## Team Communication Requirements

### Daily

- Async standup (written, in Slack or equivalent): what I built yesterday, what I'm building today, what is blocking me. No meeting required.
- Constitutional violation alerts: immediate async message when `constitutional-boundary-check.ts` fails, with the specific violation and the engineer's proposed fix

### Weekly

- Technical sync (60 minutes): Technical Lead + all engineers. Agenda: critical path status, constitutional decision log (any decisions made this week that affect the architecture), upcoming wave planning
- PR review turnaround: all PRs must receive at least one review within 24 business hours. PRs touching constitutional substrate must receive Technical Lead review before merge.

### Per-Wave

- Wave kickoff: 90-minute session. Technical Lead walks through the wave's constitutional requirements, the allowed shortcuts, and the forbidden shortcuts. All engineers attend.
- Wave gate review: 60-minute session before the wave's operational readiness gate is declared passed. Technical Lead and DevOps verify all gate criteria against a checklist. The checklist is committed to the repository as part of the wave's documentation.
- Wave retrospective: 60-minute session after the gate passes. What slipped from the plan? What deviations were made? Were any constitutional shortcuts taken that were not pre-approved? Update IMPLEMENTATION-WAVES.md with actual outcomes.

---

## Hiring Sequence (if building the team from scratch)

If the team does not yet exist, hire in this order:

1. **Technical Lead** (hire first — constitutional architecture must be established before any implementation decisions are made)
2. **DevOps / Platform Engineer** (hire second — PostgreSQL and CI must be set up before backend work begins)
3. **Backend Engineer 1 (CMS API)** and **Backend Engineer 2 (replay audit / corpus publisher)** (hire simultaneously with DevOps)
4. **Edge Engineer** (hire by Week 1 to allow hardware order to be placed immediately)
5. **Frontend Engineer 1 (cms-web)** (hire by Week 2 — can start on auth flow and routing before backend is ready)
6. **Backend Engineer 3 (entropy / shadow / canary)** (hire by Week 6 — needed for Wave 2 audit service)
7. **Frontend Engineer 2 (player-ui / mobile)** (hire by Week 3)
8. **Mobile Engineer** (hire by Week 18 — needed for Wave 4 mobile PWA, starts Wave 4 Week 21)
