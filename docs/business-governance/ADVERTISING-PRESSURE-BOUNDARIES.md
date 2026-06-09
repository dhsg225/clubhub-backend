# ClubHub TV — Advertising Pressure Boundaries

**Document type:** Business governance specification — constitutional protection layer
**Authority:** Platform governance — highest authority; overrides any commercial guidance
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, commercial/sales teams, platform engineering, legal
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, SPONSORSHIP-GOVERNANCE.md, REVENUE-CONFLICT-MODELS.md, PRE-REFERENCE-IMPLEMENTATION-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. The Central Principle

Advertising is a service the ClubHub TV platform delivers on top of its constitutional infrastructure. The constitutional infrastructure is not modifiable by advertising requirements.

This sentence is the foundational boundary. Everything in this document elaborates on it.

The practical meaning: when an advertising need conflicts with a constitutional guarantee, the constitutional guarantee wins. Without exception. Without "emergency override" process. Without escalation to a senior commercial relationship holder. The constitutional guarantee wins because it is a property of the platform's design, not a policy preference that can be negotiated.

This is not anti-commercial. Venues that choose ClubHub TV choose it precisely because it is a platform operators and regulators can trust. That trust is worth more than any individual sponsor arrangement. Allowing advertising pressure to compromise constitutional guarantees would destroy the trust foundation that makes the platform commercially viable.

---

## 2. Absolute Boundaries — The Seven Prohibitions

These are the boundaries that no commercial arrangement, "premium tier" offering, SLA clause, or escalation path can cross. Each is stated in plain terms and then with the constitutional rationale.

---

### Prohibition 1: Commercial Elevation of Advertising Content

**The boundary:** Advertising content (LEVEL_4) cannot be elevated to LEVEL_0 through LEVEL_3 through any commercial mechanism. "Premium sponsorship," "priority placement," "guaranteed position" — none of these terms, regardless of what they mean in the commercial agreement, can grant LEVEL_3 or LEVEL_2 placement to sponsor content in the PRE resolution hierarchy.

**What this looks like in practice:** A sponsor pays a premium rate and expects their content to "always be visible." The commercial team promises "guaranteed placement." When this reaches the platform, the implementation is: LEVEL_4 configuration with maximum weighting in the LEVEL_4 slot pool. The sponsor's content plays whenever no LEVEL_0 through LEVEL_3 content is active. It does not play when those levels are active. The commercial promise cannot be fulfilled by platform elevation.

**Constitutional rationale:** LEVEL_3 authority (campaigns and scheduling) is held by ENTERPRISE_ADMIN and VENUE_OPERATOR. These operators have accepted constitutional obligations regarding their content. Allowing a sponsor to buy into LEVEL_3 would give a commercial actor operational authority they have not accepted responsibility for. The resolution hierarchy exists to protect operational integrity — any breach of level separation undermines the entire hierarchy.

**What the platform can offer instead:** Maximum LEVEL_4 weighting, prominent placement within the LEVEL_4 slot pool, real-time visibility into delivery rates, and proof-of-play reporting that demonstrates the sponsor received the maximum available airtime at their level.

---

### Prohibition 2: Compliance Content Suppression

**The boundary:** LEVEL_1 compliance content (responsible gambling messaging, liquor license conditions, minor exclusion notices, jurisdiction-mandated regulatory content) cannot be suppressed, shortened, repositioned, or frequency-reduced by any commercial arrangement.

**What this looks like in practice:** A gambling brand sponsor wants to increase their airtime. Their proposal requires reducing the frequency of responsible gambling messaging or removing it from certain screens entirely to make more time available for their content. This is not possible. L1 slot frequency is set by regulatory requirements and venue compliance configuration. No commercial arrangement modifies it. The answer is always no, regardless of the commercial value of the relationship.

**Constitutional rationale:** L1 compliance content is not a venue preference. In licensed environments, it is a condition of the venue's operating license. Suppressing it to accommodate advertising creates regulatory exposure for the venue that could result in license revocation. The platform would be actively harming its operators to benefit an advertiser. This is categorically outside the platform's purpose.

**Special case — gambling-adjacent sponsors:** Wagering, gaming machine, and lottery sponsors in licensed venues are subject to additional review because their content category is directly adjacent to the compliance content. Responsible gambling messaging must remain at its regulatory minimum frequency. Gambling-adjacent sponsor content must not be configured in immediately adjacent rotation positions to responsible gambling messaging. The preview system must be used to verify content adjacency before activation.

---

### Prohibition 3: Emergency Flow Interference

**The boundary:** Advertising pressure cannot prevent, delay, or shorten EMERGENCY_FREEZE transitions, circuit breaker activations, or any constitutional state machine transitions.

**What this looks like in practice:** A high-value sponsor has a live campaign running during a major event. A constitutional event (EMERGENCY_FREEZE triggered by fleet-wide entropy breach) occurs. All sponsor content is immediately suppressed across the fleet. The sponsor's commercial team escalates, arguing that their campaign SLA is being violated and requesting that the EMERGENCY_FREEZE be lifted to restore their airtime. This is not a valid request. EMERGENCY_FREEZE duration is determined by technical safety criteria. It exits when the technical conditions are resolved, not when commercial pressure is applied.

**Constitutional rationale:** EMERGENCY_FREEZE exists because the platform has detected conditions that make normal operation unsafe. Exiting it prematurely because of commercial pressure would expose the fleet to exactly the conditions that triggered the protection. The constitutional state machine is designed to be immune to pressure — including commercial pressure — precisely because pressure is often highest when the need for protection is also highest.

**What the platform can offer:** Accurate records of the EMERGENCY_FREEZE duration, the technical triggers that caused it, and the exact airtime impact on the sponsor's campaign. These records support commercial resolution outside the system.

---

### Prohibition 4: Canary Promotion Acceleration

**The boundary:** Sponsor-requested deployment acceleration cannot compress canary stage timelines or bypass constitutional deployment gates.

**What this looks like in practice:** A sponsor has a time-sensitive campaign (tied to a sporting event, seasonal promotion, or news event). They request that their content be deployed to all screens immediately, bypassing the normal canary promotion stages. The deployment process has constitutional gates that require time and verification. These gates cannot be compressed for commercial reasons.

**Constitutional rationale:** Canary deployment stages exist to detect failures before they propagate to the full fleet. Compressing them because a sponsor has an urgent commercial need would expose the entire fleet to failures that the canary process is designed to catch. A deployment failure at full fleet scale affects all operators, all sponsors, and all viewers — the commercial urgency of one sponsor does not justify that exposure.

**What the platform can offer:** The fastest constitutionally safe deployment — maximum automation, minimum administrative delay, full use of parallel canary stages where safe. The timeline is compressed to the technical minimum, not to the commercial request.

---

### Prohibition 5: Proof-of-Play Data Integrity

**The boundary:** Replay audit records used for proof-of-play generation cannot be modified, selectively reported, or adjusted to show a more favorable delivery picture than the system actually produced.

**What this looks like in practice:** A sponsor's proof-of-play report shows delivered SOV of 18% against a committed SOV of 25%. The shortfall was caused by a venue-wide operational override that the operator applied for legitimate operational reasons. The sponsor's commercial team requests a revised report that excludes the override period or adjusts the denominator to make the delivered percentage appear higher. This is not possible. The audit records are append-only and tamper-evident. The proof-of-play report is a reconstruction of what actually happened.

**Constitutional rationale:** The value of the proof-of-play system — to operators, to sponsors, and as a regulatory compliance tool — depends entirely on its integrity. A proof-of-play report that can be modified on commercial request is no longer proof. It is an assertion. The platform's credibility as a third-party delivery verification system would be destroyed if reports could be adjusted for commercial purposes.

**What the platform can offer:** The suppression event breakdown in the proof-of-play report shows exactly why the SOV was below commitment and which operational events caused the suppression. This enables commercial resolution based on accurate facts. If the shortfall was caused by operational override (LEVEL_1) rather than configuration error, that distinction is clear in the report.

---

### Prohibition 6: Entropy Alert Override by Commercial Pressure

**The boundary:** Commercial pressure to "just acknowledge" entropy alerts so that airtime delivery can continue running without interruption cannot override the authority requirements for CRITICAL entropy acknowledgment.

**What this looks like in practice:** A CRITICAL entropy alert fires during a live sponsor campaign. Entropy acknowledgment at CRITICAL level requires ENTERPRISE_ADMIN authority. The sponsor's representative contacts the venue's operations team and pressures them to acknowledge the alert quickly so the campaign can continue. A VENUE_OPERATOR cannot acknowledge a CRITICAL entropy alert — only ENTERPRISE_ADMIN can. The authority requirement is not configurable and cannot be bypassed because of commercial urgency.

**Constitutional rationale:** CRITICAL entropy conditions indicate that the platform's content state is in a condition that requires senior authority review before operations continue. The authority requirement is proportional to the severity. Bypassing it — even for a fraction of the entropy detection-to-response cycle — would allow high-severity operational conditions to be dismissed by actors who do not have the authority or context to evaluate them appropriately.

**What the platform can offer:** Clear escalation paths to the appropriate authority holder. The ENTERPRISE_ADMIN is notified immediately when CRITICAL entropy acknowledgment is required. The platform does not prevent escalation; it requires that the right person performs the acknowledgment.

---

### Prohibition 7: Constitutional State Timeline Compression by SLA Pressure

**The boundary:** No commercial arrangement compresses EMERGENCY_FREEZE exit timelines. The timeline for returning from a constitutional protective state to normal operations is determined by technical safety criteria, not by sponsor SLA urgency.

**This is closely related to Prohibition 3 but distinct:** Prohibition 3 addresses the activation and triggering of protective states. Prohibition 7 addresses the exit conditions. Both directions — entry and exit — are immune to commercial pressure.

**What this looks like in practice:** EMERGENCY_FREEZE is active. The exit conditions are defined by technical criteria: entropy must be below threshold, critical corpus assets must be verified, canary validation must complete. A sponsor whose campaign is being suppressed during the EMERGENCY_FREEZE escalates via their commercial relationship with the enterprise, pressuring the ENTERPRISE_ADMIN to declare the constitutional state cleared before the technical criteria are met. This cannot produce system state change. The platform's constitutional state is not modified by authority escalation — it is modified by technical criteria.

**What the platform can offer:** Real-time constitutional state visibility for ENTERPRISE_ADMIN (not SPONSOR_STAKEHOLDER) and accurate records of the state duration and technical criteria for exit.

---

## 3. Permitted Commercial Flexibility

The prohibitions above are absolute. Within those constraints, there is significant flexibility for commercial arrangement:

### 3.1 LEVEL_4 Slot Configuration

Within the LEVEL_4 resolution layer, sponsor slots are highly configurable:
- Time windows can be precisely defined
- Zone targeting can be as specific as an individual screen
- Rotation weighting within the L4 pool can be configured to give one sponsor more frequency than another
- Exclusivity can be enforced within the L4 pool for a zone/category combination

These configuration parameters allow meaningful commercial differentiation within the L4 layer.

### 3.2 Preview Access

Sponsors can preview their content extensively before contract activation. The preview system allows:
- Viewing the sponsor's content as it resolves in the L4 context
- Reviewing the screen rotation context (what else appears at L4 in the same zone)
- Previewing across multiple contract scenarios before committing to a configuration

Preview does not cost additional delivery airtime. Sponsors can preview as extensively as needed before activating.

### 3.3 Proof-of-Play Report Customization

The format and delivery of proof-of-play reports can be customized within the constraint that the underlying data is unmodified:
- Report time granularity: hourly, daily, weekly, or custom period summaries
- Screen grouping: aggregate by zone, by building, or per individual screen
- Delivery format: downloadable PDF, structured JSON via API webhook, CSV
- Delivery schedule: on-demand, automated periodic (daily, weekly, monthly), triggered on contract period end

Content of the report — the actual delivery figures — is not customizable. Format and delivery are.

### 3.4 SOV Alert Thresholds

Sponsors (via SPONSOR_STAKEHOLDER) and operators (via ENTERPRISE_ADMIN and VENUE_OPERATOR) can configure alert thresholds for when SOV falls below commitment:
- Warning threshold: alert when delivered SOV falls below committed SOV by more than X%
- Critical threshold: alert when delivered SOV shortfall persists for more than Y days
- Alert recipients: which roles receive the alert notification

These thresholds govern when the system surfaces information proactively. They do not govern system behavior — the platform does not take automated action to restore SOV when thresholds are breached.

---

## 4. Commercial Escalation Path

When a constitutional event causes sponsor SLA impact, the commercial escalation path is:

**Step 1 — Platform provides evidence:** The proof-of-play report for the affected period, including suppression event detail (type, duration, affected screens), is available immediately.

**Step 2 — ENTERPRISE_ADMIN notified:** The enterprise's ENTERPRISE_ADMIN receives a notification summarizing the constitutional event and its impact on sponsor airtime across the fleet.

**Step 3 — Sponsor notified:** ENTERPRISE_ADMIN notifies the affected sponsors of the event and the airtime impact, providing the proof-of-play data as supporting evidence.

**Step 4 — Commercial resolution:** Whether the SLA miss triggers compensation, contract adjustment, or other commercial remedy is a matter entirely between the enterprise and the sponsor, resolved through their commercial relationship outside the platform.

**Step 5 — Resolution recorded:** The commercial resolution (if any) is recorded by the enterprise's commercial team outside the platform. The platform's records remain unchanged.

The platform's role ends at Step 3. It provides accurate, tamper-evident evidence. It does not participate in commercial negotiation or enforcement.

---

## 5. Why This Model Is Commercially Sound

The prohibitions in this document might appear restrictive. They are not — they are the foundation of a commercially sustainable platform.

**Sponsors trust proof-of-play because it cannot be manipulated.** If proof-of-play could be adjusted commercially, it would be worthless as evidence. Sponsors accept proof-of-play as authoritative precisely because the system does not allow modification.

**Operators trust that compliance cannot be compromised.** A licensed venue that worries their compliance messaging could be displaced by a sponsor is a venue looking for another platform. The absolute compliance floor protects operators from commercial risk they cannot afford.

**Regulators accept PRE-generated audit records as evidence.** Regulatory acceptance of the platform's audit records depends on their integrity. Audit manipulation — even minor, commercially motivated manipulation — would destroy regulatory acceptance and expose operators to liability.

**The constitutional guarantees are the product.** Venues pay for a platform they can trust to be predictable and safe. The constitutional guarantees are not a cost of doing business. They are the reason operators choose the platform. Protecting them protects the commercial model.

---

*End of ADVERTISING-PRESSURE-BOUNDARIES.md*
*Constitutional invariants: ENGINEERING-CONSTITUTION-v1.md. Emergency state machine: INCIDENT_ORCHESTRATION.md. Entropy governance: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md.*
