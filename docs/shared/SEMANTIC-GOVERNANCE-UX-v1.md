# ClubHub TV — Semantic Governance UX v1
# How Language Remains Stable Across Years

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design), with Agent 2 (CMS) co-authority on canonical terminology
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors, product writers, support staff
**Depends on:** DOMAIN-LANGUAGE-GLOSSARY.md, KNOWLEDGE-CLASSIFICATION-SYSTEM.md, CROSS-AGENT-GOVERNANCE.md, OPERATOR-COGNITIVE-MODELS-v1.md, HUMAN-TRUST-AND-PREDICTABILITY-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Semantic Governance Philosophy

---

### 1.1 Language as Operational Infrastructure

In most software systems, the words used in the interface are copy — a concern of product writers and UX designers, reviewed for tone and clarity, updated as products evolve. Words can change as long as the new words are clearer than the old ones.

In ClubHub TV, this approach would be catastrophic.

Operators form mental models of system behavior through the language the system uses to describe itself. An operator who learns the word "override" associates it with a specific set of system behaviors: temporary, higher-priority, displacing campaigns. If the system renames "override" to "priority lock" in a subsequent release, the operator now has a broken mental model — they know what "override" means but not what "priority lock" means, and they cannot be sure the behaviors are the same.

**Language in ClubHub TV is operational infrastructure**, in the same way that the resolution hierarchy is operational infrastructure. It must be versioned, governed, and changed only with explicit migration planning. Casual copy changes that "improve clarity" can destroy operator mental models that took months to build.

---

### 1.2 Terminology Stability

The canonical terminology in DOMAIN-LANGUAGE-GLOSSARY.md is the foundation. Every operator-facing term that refers to a specific system concept must:

1. Have exactly one canonical form (the word or phrase used in the glossary)
2. Have exactly one meaning (the behavior it describes is stable)
3. Change only through a formal process (not through casual copy editing)
4. Change with operator communication (not silently)

**Terminology stability is not the same as terminology perfection.** Some canonical terms are imperfect — they could be clearer, more intuitive, more accessible. These imperfections are tolerated because changing them has a higher cost than keeping them. An imperfect stable term is safer than a perfect term that is renamed frequently.

**When a term must change:** The term change process (§6.1) governs this. Changes require documentation update, operator communication, in-product transition support, and a minimum deprecation period before the old term is removed.

---

### 1.3 Anti-Folklore Semantics

Folklore emerges in the vocabulary gap — when the system does not have a word for something, operators invent their own. The invented vocabulary is often imprecise, sometimes incorrect, and always divergent from canonical terminology.

**The vocabulary gap prevention strategy:** The canonical terminology system must provide words for every operationally significant concept. If operators are using informal terms that the glossary does not contain, this is a signal that the canonical vocabulary is incomplete.

Common vocabulary gaps that generate folklore:
- No canonical term for "a rule that is configured correctly but not winning" → operators invent "broken campaign"
- No canonical term for "the specific combination of level and specificity that determines which rule wins" → operators invent "priority order" (which conflates two distinct properties)
- No canonical term for "a screen that has been offline and is serving stale manifest" → operators invent "frozen screen"

**Each vocabulary gap must be closed by adding a canonical term, not by accepting the folk vocabulary.** When a folk term is discovered, the glossary must be updated to include a canonical term for that concept, and the folk term must be explicitly addressed (either adopted and defined, or redirected to the canonical term with an explanation of the difference).

---

### 1.4 Operational Meaning Preservation

Canonical terms must preserve their meaning over time. If "override" described an immediate, higher-priority content replacement in 2025, it must describe the same behavior in 2028. If the system's behavior for that concept changes, the change must be communicated as a behavior change, not allowed to silently shift the meaning of an existing term.

**Meaning drift failure mode:** The term "campaign" is introduced to mean "a managed set of content rules with a start date, end date, and targeting scope." Over time, as campaigns gain new features (recurring schedules, multi-channel delivery, A/B testing), operators begin using "campaign" to mean different things. Some mean the original definition. Some mean the full-featured version. When operators talk about campaigns, they may not realize they are describing different things.

**Prevention:** When a concept gains significant new behaviors, it requires either a new term (for the extended concept) or a versioned migration ("Campaign v2 now includes X and Y, previously separate features"). The meaning of the original term is preserved or explicitly deprecated.

---

## Part 2 — Canonical Terminology System

---

### 2.1 The Term Registry

Every operator-facing term that refers to a system concept must be registered in the canonical term registry (DOMAIN-LANGUAGE-GLOSSARY.md). The registry specifies:

| Field | Description |
|-------|-------------|
| Canonical term | The exact word or phrase used in the CMS |
| Definition | What the term means (in operator language, not technical language) |
| System concept | What PRE/CMS concept this term maps to |
| Forbidden synonyms | Words that refer to the same concept but must not be used (causes ambiguity) |
| Related terms | Other terms in the registry that operators may confuse with this one |
| Version introduced | When this term was added |
| Deprecated terms | Old terms for this concept, with deprecation date and migration note |

---

### 2.2 Canonical PRE Terms

The most important canonical terms are those referring to PRE concepts — the resolution hierarchy, content rules, and system behaviors that operators must understand accurately.

**Canonical terms for PRE concepts (summary):**

| System concept | Canonical operator term | Forbidden synonyms |
|----------------|------------------------|--------------------|
| PRE resolution LEVEL_0 | Emergency content | "Safety override," "emergency lock," "alert mode" |
| PRE resolution LEVEL_1 | Operational override | "Direct override," "manual override," "forced content," "priority lock" |
| PRE resolution LEVEL_2 | Scheduled override | "Timed override," "event override," "planned override" |
| PRE resolution LEVEL_3 | Campaign | "Schedule," "content package," "playlist assignment" (when used as noun for a campaign) |
| PRE resolution LEVEL_4 | Sponsor content | "Ad insertion," "commercial break," "sponsor slot" |
| PRE resolution LEVEL_5 | Fallback content | "Default content," "backup content," "safe content" |
| PRE resolution LEVEL_6 | Device default | "Factory default," "baseline content" |
| SWRR weight | Content frequency | "Priority," "importance," "rank" (when referring to frequency within a playlist) |
| Reason trace | Resolution explanation | "Debug info," "resolution log," "why it's playing info" |
| Confidence score | Delivery confidence | "Signal strength," "connection status," "content assurance" |
| Specificity | Rule targeting precision | "Specificity level" is the canonical compound — "scope priority" is forbidden |

**Why forbidden synonyms matter:** When a synonym is used in one part of the CMS and the canonical term in another, operators form a belief that they are different things. "Manual override" and "Operational override" look like they refer to different concepts — one sounds like a human action, one sounds like an automated system behavior.

---

### 2.3 Forbidden Ambiguous Language

Some words are prohibited in ClubHub TV operator-facing copy because they are ambiguous — they mean different things in different contexts, and their use prevents operators from forming clear mental models.

**Prohibited words and their canonical replacements:**

| Prohibited word | Problem | Canonical replacement |
|----------------|---------|----------------------|
| "Priority" (unqualified) | Ambiguous between resolution level and SWRR weight | "Resolution level" (for hierarchy position) or "content frequency" (for SWRR weight) |
| "Active" (unqualified for campaigns) | Does not distinguish between "configured and valid" vs "currently winning" | "Configured" (set up and valid) vs "Winning" (currently delivering on a screen) |
| "Schedule" (as noun, for campaign) | Campaigns and direct schedules are distinct concepts | "Campaign" (managed content program) vs "schedule" (time window within a campaign) |
| "Override" (unqualified) | Does not distinguish LEVEL_1 from LEVEL_2 | "Operational override" (LEVEL_1) vs "Scheduled override" (LEVEL_2) |
| "Priority" for operator permission level | Collides with "priority" in content context | "Access level" or "operator role" for permission hierarchy |
| "Content" alone when "content item" is meant | "Content" is too broad; may refer to campaigns, overrides, or items | "Content item" (specific media), "campaign content" (items within campaign), "override content" (item in an override) |
| "Blocked" | Vague — does not indicate whether blocking is from above or from targeting mismatch | "Suppressed by [rule]" (level outranked) or "Not targeted to this screen" (scope mismatch) |

---

### 2.4 Vertical-Specific Presentation Adaptation

Canonical terms can be **presented** differently across market verticals, as long as the underlying canonical term is preserved and accessible.

**Presentation adaptation (allowed):**
- Golf club operators may see "Tournament content" where the canonical term is "Campaign" — because the operational context is a tournament, not a generic promotion
- Sports bar operators may see "Event override" where the canonical term is "Operational override" — because their overrides are usually event-specific
- Hotel operators may see "Guest experience content" where the canonical term is "Campaign" — because the operational frame is hospitality, not promotion

**Presentation adaptation rules:**
1. The adapted presentation must always link to or disclose the canonical term
2. The canonical term must be used in all explainability and diagnostic surfaces (reason traces, resolution traces, training materials)
3. The adapted term cannot hide or obscure the system behavior the canonical term describes

**Adaptation is a surface-level translation, not a semantic redefinition.** "Tournament content" is a label for campaigns in the golf club context. It does not change what campaigns do, how they resolve, or how they appear in the resolution trace (which always shows "Campaign" as the canonical level label).

---

### 2.5 Meaning-Preservation Rules

When any term in the canonical registry must change (definition update, behavior change, deprecation), the following rules apply:

**Rule M-01:** No term may change meaning without a version increment in the glossary
**Rule M-02:** The old meaning must be documented as the deprecated definition with the version it was deprecated
**Rule M-03:** Any existing documentation, training materials, or in-product text using the old meaning must be updated
**Rule M-04:** Operators must receive communication about the meaning change before the CMS deploys it
**Rule M-05:** A minimum of one release cycle between communication and deployment of the meaning change

---

## Part 3 — Semantic Drift Detection

---

### 3.1 Local Terminology Mutation

Local terminology mutation occurs when operators at specific venues develop their own vocabulary — often shorthand derived from operational experience. "The lock" for operational override. "Dead air" for fallback content. "The ad slot" for sponsor injection.

Local mutations are not initially harmful. They become harmful when:
- They are used in training new operators, who learn the local vocabulary instead of the canonical vocabulary
- They are used in support conversations, producing communication failures with support staff who use canonical terms
- They diverge from canonical terms in meaning, not just label (operators believe "the lock" behaves differently from "operational override")

**Detection mechanism:** Support ticket and communication monitoring for non-canonical terms. When support staff encounter a term not in the canonical registry that an operator is using to describe a system behavior, this is flagged as a potential local mutation.

**Response:** Document the local term, map it to the canonical term, determine whether the local term reveals a vocabulary gap in the canonical registry, and include in next glossary review.

---

### 3.2 Workaround Vocabulary Emergence

When operators develop workarounds (OPERATOR-COGNITIVE-MODELS-v1.md §6), they develop vocabulary to describe those workarounds. "Power override" for an escalated operational override. "Nuclear option" for global emergency activation. "Refresh trick" for deactivating and reactivating a rule to force a manifest update.

Workaround vocabulary reveals gaps in both functionality and terminology. If operators have a name for a workaround, the workaround is common enough to have been named — which means it is common enough to warrant:
1. Understanding why it is used (is it solving a real operational problem that should be addressed?)
2. Either eliminating the need for the workaround (fix the underlying problem) or documenting the legitimate use (add the workflow to the CMS officially)
3. Retiring the informal vocabulary through official documentation and canonical term addition

---

### 3.3 Regional Semantic Divergence

Different regions may develop different terminology conventions, particularly in organizations with strong regional management cultures. The western region's "content lock" is the eastern region's "operational override" — same system behavior, different words.

**Regional semantic divergence detection:**

In multi-region organizations, the semantic governance system monitors for terminology divergence in:
- Support tickets (do different regions use different words for the same concepts?)
- Training materials created by regional managers (do regional materials use canonical terms?)
- Incident reports (do incident descriptions from different regions describe the same events with different vocabulary?)

**Response:** Regional terminology alignment workshops, centralized training material review, and canonical term inclusion in onboarding for all new operators regardless of region.

---

### 3.4 Documentation Drift

Documentation drift occurs when the CMS copy and the training materials describe the same concepts differently — either because they were written by different people, or because one was updated and the other wasn't.

**Documentation drift symptoms:**
- Training materials use a term that the CMS no longer uses
- The help text in the CMS contradicts the behavior described in the training documentation
- The glossary term definition differs from the in-product tooltip description of the same concept

**Prevention:** Documentation synchronization in the release process. Every release that changes operator-facing copy or behavior must include a documentation review step that checks for divergence between CMS copy, help documentation, training materials, and the canonical glossary.

---

## Part 4 — Cross-Vertical Language Strategy

---

### 4.1 Hospitality Language Adaptation

Hospitality venues (hotels, resorts, restaurants) use language that prioritizes guest experience framing rather than operational management framing. The same system concepts described in operational terms for a licensed club must be described in hospitality terms for a hotel.

**Hospitality adaptation table:**

| Canonical term | Licensed club framing | Hospitality framing |
|----------------|----------------------|---------------------|
| Operational override | "Manual override — bypasses campaign schedule" | "Guest experience update — immediate content change" |
| Fallback content | "Fallback — no campaign matched" | "Default ambiance — no special programming active" |
| Entropy health grade | "Venue health: C" | "Content program health: Needs review" |
| Campaign | "Campaign — scheduled content program" | "Experience program — your curated content schedule" |

**Adaptation principle:** The hospitality framing must not obscure operational reality. "Guest experience update" is a legitimate adaptation of "manual override" in a hospitality context — it describes the same thing with appropriate framing. It must not be used to make operational overrides feel consequence-free when they have operational consequences (sponsor displacement, entropy accumulation).

---

### 4.2 Sports Operations Language

Sports venues (sports bars, golf clubs, sports facilities) use language oriented toward events and live operations. Content management is described in terms of game schedules, tournament programs, and match-day operations.

**Sports adaptation table:**

| Canonical term | Standard framing | Sports operations framing |
|----------------|-----------------|--------------------------|
| Operational override | "Operational override" | "Match day override" (for match context), "Event override" (generic) |
| Campaign | "Campaign" | "Season program" (for ongoing season content), "Match night promotion" (for event-specific) |
| Emergency content | "Emergency content" | "Emergency content" (unchanged — safety terms must not be localized) |
| Coverage gap | "Coverage gap" | "Unscheduled window" |

**Safety term rule:** Terms describing safety-critical concepts (emergency content, compliance content) must never be adapted or localized. The canonical safety vocabulary must be consistent across all verticals to prevent semantic collapse under emergency conditions.

---

### 4.3 Sponsorship Language

Sponsorship management uses business language — contracts, obligations, fulfillment, SOV. This vocabulary must bridge between the operational CMS language (campaigns, overrides, resolution levels) and the business relationship language (contracts, promised delivery, proof of performance).

**Bridging vocabulary:**

| CMS concept | Business concept | Bridging term |
|-------------|-----------------|---------------|
| LEVEL_4 sponsor injection | Contracted sponsor delivery | "Sponsored content slot" |
| SOV percentage | Contract obligation fulfillment | "Delivery rate" |
| Override suppressing sponsor content | Sponsor content displacement | "Content displacement" (not "override blocking") |
| Proof-of-play report | Contract delivery evidence | "Delivery confirmation report" |

The bridging vocabulary is used in sponsorship-facing contexts. The CMS technical vocabulary is used in operations contexts. Both are legitimate — they address different audiences with different frames.

---

### 4.4 Executive Abstraction Language

Executive communication removes operational detail and expresses system health in business terms. The translation layer:

| Operational concept | Executive concept |
|--------------------|-------------------|
| Venue health grade D | "Venue requires operational attention" |
| Override accumulation | "Configuration debt has accumulated at this venue" |
| SOV 19% vs contracted 25% | "Sponsor delivery is 24% below contract" |
| Entropy metric M-01 elevated | "Override usage is unusually high relative to peer venues" |
| LEVEL_0 emergency active | "Emergency content protocol is active" (no level numbers for executives) |

**Executive language rules:**
- No resolution level numbers or identifiers
- No entropy metric identifiers (M-01 through M-12)
- No PRE-specific vocabulary
- Business outcomes, not system mechanisms
- Action-oriented: what should happen, not just what is happening

---

## Part 5 — Explainability Language Rules

---

### 5.1 Suppression Wording

When explaining why content is not playing (EXPLAINABILITY-UX-SPEC-v1.md Q3), the suppression explanation must use specific, canonical language.

**Suppression wording rules:**

| Suppression reason | Required wording |
|-------------------|-----------------|
| Higher resolution level wins | "[RULE_NAME] at [LEVEL] takes precedence over your [RULE_TYPE] at [LEVEL]" |
| Same level, higher specificity | "A more specifically targeted [RULE_TYPE] is active for these exact screens" |
| Outside validity window | "This rule is not scheduled for this time window" |
| Scope mismatch | "This rule is not configured to target this screen" |
| Empty content | "This rule has no content — all items are expired or removed" |

**Forbidden suppression language:**
- "Your content was blocked" (blocked implies active interference; suppression is passive precedence)
- "The system overrode your campaign" (the system did not take an action; a rule takes precedence)
- "This content lost" (correct technically, but too casual for operational context)

---

### 5.2 Override Wording

Override descriptions must always specify the type and the operational implication:

**Required elements in override descriptions:**
1. The type: "Operational override" or "Scheduled override"
2. The scope: "active on [specific screens]"
3. The temporal state: "created [date], expires [date or 'no expiry']"
4. The creator: "created by [operator name]"
5. The displacement: "while this override is active, [campaign/sponsor content] will not show on these screens"

**Forbidden override language:**
- "Override is blocking your content" (implies intent; override is not intentional about other rules)
- "Your content will show when the override is removed" (technically correct but implies passivity — the correct behavior is the campaign resuming because it is the new winner)
- "The override is winning" (overrides do not "win" — they resolve at a higher level)

The correct language: "[RULE_NAME] at LEVEL_1 (Operational Override) is the current winning rule for this screen. Your campaign at LEVEL_3 is correctly configured but is not evaluated while a LEVEL_1 rule is active."

---

### 5.3 Uncertainty Wording

When the system has limited confidence in a prediction or state report, uncertainty must be expressed honestly:

**Confidence level language:**

| Confidence classification | Required wording |
|--------------------------|-----------------|
| STABLE | "Expected to play" or "Configured to play" |
| CONDITIONAL | "Expected to play if [condition] remains unchanged" |
| UNCERTAIN | "May play — this window has unstable configuration" |
| LOW CONFIDENCE | "Cannot reliably predict — [reason]" |

**Forbidden certainty language when confident is LOW or UNCERTAIN:**
- "Will play" (implies certainty)
- "Is playing" (implies current confirmed delivery)
- "Confirmed" (implies delivery log confirmation)

**Honest uncertainty wording examples:**

✓ "Last confirmed playing: 47 minutes ago (device offline)"
✗ "Currently playing [CONTENT]" (when delivery is unconfirmed)

✓ "Expected to resume when Override_004 expires — but this cannot be verified until delivery is confirmed"
✗ "Will resume on Saturday"

---

### 5.4 Confidence Wording

Confidence scores express the system's certainty about delivery confirmation — a trailing indicator, not a real-time one. The language must reflect this.

**Confidence score language rules:**
- Never "currently showing" — use "last confirmed showing"
- Never "is playing" — use "was last confirmed playing at [time]"
- Never "100% confidence" — no delivery confirmation system can achieve 100% certainty
- Always include the timestamp of the last confirmation: "last confirmed at [time]"

**Confidence level display language:**

| Score range | Display language |
|-------------|-----------------|
| 90–100% | "High confidence — confirmed recently" |
| 70–90% | "Good confidence — confirmed within [N] minutes" |
| 50–70% | "Moderate confidence — last confirmed [time ago]" |
| 30–50% | "Low confidence — not recently confirmed" |
| 0–30% | "Very low confidence — may not be delivering" |

---

### 5.5 Replay Wording

Replay surfaces must always make clear that the displayed state is historical, not current.

**Required replay labels:**
- Always: "Historical reconstruction — [date and time]"
- Always: "This is not current state — return to live view to see current state"
- Always: "This reconstruction is based on preserved system state from [date]. Due to PRE determinism, it is identical to the original live computation."

**Forbidden replay language:**
- "The screen was showing" (past tense correctly distinguishes from present, but without the explicit historical reconstruction label it may not be clear enough)
- Any display of historical state without a visible timestamp and "historical" label

---

## Part 6 — Semantic Training Systems

---

### 6.1 Onboarding Language Education

Operator onboarding must explicitly teach the canonical vocabulary — not as a separate vocabulary lesson, but integrated into the operational context where each term first appears.

**Contextual term introduction:**

When an operator encounters a canonical term for the first time (as a new user), the CMS surfaces a brief in-context definition:

```
This screen is controlled by an Operational Override.

Operational Override: A manual content change that takes precedence over your
campaign schedule. Active until the override expires or is removed.
[Learn more about operational overrides]
```

This is not a mandatory tutorial — it appears once, contextually, and can be dismissed. It teaches the term in the context where it is operationally relevant, not in a separate glossary session.

---

### 6.2 Glossary Reinforcement

The canonical glossary must be accessible from anywhere in the CMS — not only from a help menu, but from any term where it is operationally relevant.

**Inline glossary links:**

Any canonical term in operational explanations, impact previews, or status displays is linked to its glossary entry:

```
This Operational Override [?] is suppressing your Campaign [?] on Screen B1.
```

Tapping [?] opens a brief glossary pop-over with the canonical definition. The glossary is always one tap away from any canonical term in any context.

---

### 6.3 Contextual Terminology Teaching

Beyond initial onboarding, the system teaches vocabulary through operational experience — when an operator encounters a new situation, the relevant vocabulary is surfaced:

**First-time override creation:**
```
You're creating your first Operational Override.
Quick note: Operational overrides take precedence over campaigns and scheduled
overrides, but not over emergency content. They remain active until their
expiry date or until manually removed.
```

**First sponsor SOV alert:**
```
Your sponsor's Share of Voice (SOV) has fallen below contract.
SOV is the percentage of total content time that a sponsor's content receives.
Your contract specifies [N]% SOV. Current delivery is [M]%.
```

**First encounter with resolution trace:**
```
This is a resolution trace — it shows exactly why this screen is showing
this content. Each row represents one level of the content priority system,
evaluated from top (highest priority) to bottom.
```

These contextual teaching moments are displayed once per context type and then not repeated. They are not tutorials — they are vocabulary expansions triggered by operational need.

---

### 6.4 Term Change Communication

When a canonical term must change (definition update, behavior change, deprecation), operator communication follows a structured sequence:

1. **Documentation update:** Glossary and all documentation updated with new definition and deprecation note for old definition
2. **Advance notice in CMS:** 30 days before deployment, a notice appears in the relevant section of the CMS: "Terminology update coming: [OLD_TERM] will become [NEW_TERM]"
3. **Training material update:** All training materials updated before the CMS deploys the change
4. **Deployment:** New terminology deployed in the CMS with an in-context explanation linking old and new terms
5. **Grace period:** For 90 days post-deployment, the old term redirects to the new term in search and glossary lookups
6. **Retirement:** After 90 days, the old term is fully retired from all surfaces except the "deprecated terms" section of the glossary

---

*End of SEMANTIC-GOVERNANCE-UX-v1.md*
*Document authority: Agent 3 (UX/Design); Agent 2 (CMS) co-authority on canonical terminology*
*Canonical glossary is maintained in DOMAIN-LANGUAGE-GLOSSARY.md — this document governs the process, not the content*
*Term change process requires both Agent 2 and Agent 3 approval*
