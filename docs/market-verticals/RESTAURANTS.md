# ClubHub TV — Market Vertical: Restaurants

**Document type:** Operational profile
**Vertical:** Restaurants — standalone, chains, quick service, fine dining
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Restaurants present a diverse operational profile that spans from quick service restaurants (QSR) with high-volume, price-sensitive menu board requirements to fine dining establishments where screens serve primarily atmospheric rather than informational purposes. These sub-verticals have materially different content requirements but share the same platform architecture.

The defining operational constraint in this vertical is price accuracy on menu boards. In QSR and casual dining deployments, digital menu boards show prices that patrons use to make purchasing decisions. If the displayed price differs from the POS price, the venue has both an operational problem (patron complaints, refunds) and potentially a legal problem (price accuracy is a regulatory requirement under Australian Consumer Law and equivalent legislation in other markets). This makes menu board corpus management a higher-stakes operation than in most other verticals.

For fine dining, the constraint shifts entirely: no menu boards (the menu is physical), no pricing on screens, and the content is ambient or atmospheric. Two restaurants in the same city can be deployed on the same platform with completely different operational profiles.

---

## 2. Operational Priorities

### 2.1 Menu Board Accuracy (QSR and Casual Dining)

Menu board accuracy is the primary operational concern for QSR and casual dining restaurants. The requirements:

**Price accuracy:**
- Menu board prices must match POS prices at all times
- A price change in the POS must propagate to menu boards within one poll cycle (≤2 minutes for a standard polling interval)
- This requires either a POS integration (the recommended path for chains and QSR) or a strict manual update discipline (the only option for independents without integration)
- A price discrepancy that results in a patron being charged more than the displayed price is a consumer law compliance failure

**Item availability:**
- When an item is 86'd (sold out or unavailable), it must be removable from the menu board quickly
- The VENUE_OPERATOR must be able to remove an item from the menu board display within 2 minutes of deciding to 86 it
- This is a SPECIFICITY_5 (screen-targeted) or SPECIFICITY_4 (tv_group-targeted) immediate override at L2 — the operator creates an override that substitutes the menu board content for one that excludes the unavailable item
- For integrated deployments: the POS availability flag triggers the corpus update automatically

**Allergen and dietary information:**
- In jurisdictions that require allergen disclosure on menus (EU Food Information for Consumers Regulation, for example), digital menu boards are subject to the same requirements as printed menus
- Assets carrying allergen information must have `jurisdiction_code` metadata
- Missing or incorrect allergen information is a CRITICAL entropy event in jurisdictions where disclosure is mandatory

### 2.2 Ambience and Brand (Fine Dining and Atmospheric)

For fine dining and restaurant bar contexts where screens serve atmospheric purposes:
- Content must match the dining experience — a fine dining restaurant does not show promotional pricing on its screens
- Seasonal imagery and brand photography are L5 default and L3 campaign content respectively
- Content transitions must be graceful — abrupt changes between ambient video loops are unacceptable at this tier

This sub-vertical has the lowest operational complexity of any restaurant type. The operator's primary interaction with the platform is approving the seasonal content package at the start of each season and making occasional adjustments for special events (Valentine's Day, Christmas Eve, private dining events).

### 2.3 Daily Specials

Daily specials are the primary high-frequency content management task across all restaurant sub-verticals:
- QSR: daily value meal promotions, limited-time offers
- Casual dining: chef's specials, seasonal dishes, weekly promotions
- Fine dining: no daily specials on screens (menu is physical), but set menu promotions may appear in reception/bar areas

Specials are L3 campaign content with time-of-day schedule constraints (lunch specials: 11am–3pm; dinner specials: 5pm–close). The operator creates the special, sets the time constraints, and the schedule manages activation and deactivation automatically. An operator who has to manually deactivate a lunch special at 3pm every day has a misconfigured system.

### 2.4 Promotional Programming

Seasonal menus (Christmas menu, Valentine's Day set menu), promotional campaigns (loyalty program offers, event-night specials), and draw-in content (window screens showing attractive imagery and tonight's special) are L3 campaigns with defined validity windows.

The window-facing screen is particularly important for the casual dining segment: a screen visible from the street showing tonight's special or a seasonal promotion has direct commercial impact. This screen should be treated as a dedicated zone with its own content profile — optimized for brief-attention, draw-in content rather than in-venue informational content.

---

## 3. Screen Zones and Behavior Profiles

| Zone | Sub-vertical | Content profile | Primary resolution levels |
|---|---|---|---|
| Menu boards (primary) | QSR, casual dining | Prices, items, specials, availability | L2 (overrides for 86'd items), L3, L5 |
| Atmospheric displays | Fine dining, bar | Ambient video, brand photography, seasonal | L3, L5 |
| Window / facade | All | Promotions, draw-in, hours, tonight's special | L3, L5 |
| Reception / waiting area | Casual, fine dining | Brand, wait time advisory, menu preview | L3, L5 |
| Kitchen staff display | All | Order status, kitchen display (separate system) | NOT PRE-managed — referenced only |

### 3.1 Menu Board Zone Design

For QSR and casual dining deployments, menu board screens are typically organized as TV groups by section (e.g., `menu_board_main`, `menu_board_drinks`, `menu_board_desserts`). This allows operators to update one section without affecting others.

The `menu_board_main` TV group might have:
- L5 default: the current standard menu layout
- L2 override: active when a specific item is 86'd (substitutes the standard layout with a modified version excluding the unavailable item)
- L3 campaign: lunch special overlay, active 11am–3pm via time-of-day constraint
- L3 campaign: limited-time offer campaign (e.g., new seasonal burger, 2-week validity)

All four levels can be active simultaneously and PRE resolves the correct content for each moment correctly. The operator who creates the lunch special campaign does not need to worry about it conflicting with the 86'd item override — PRE's priority hierarchy handles the intersection deterministically.

---

## 4. Menu Board Operational Requirements

### 4.1 Price Change Propagation

**Integrated deployment (POS integration):**
Price changes made in the POS system trigger a corpus variable update via the integration API. PRE resolves menu board content using the updated variable. The propagation time is approximately one poll cycle after the corpus variable update arrives. End-to-end latency from POS change to screen update: typically under 3 minutes.

**Manual deployment (no POS integration):**
The VENUE_OPERATOR updates menu board prices manually. The update requires:
1. Operator updates the price in the corpus (menu board asset or corpus variable)
2. Asset is re-rendered or the corpus variable update propagates
3. Screens pick up the update in the next poll cycle

Manual propagation requires discipline: a price change at the POS that is not reflected in the corpus is an immediate entropy event. Entropy monitoring in manual deployments must have a lower tolerance: if a price-bearing menu board asset has not been reviewed or updated in more than 7 days, this is a MEDIUM entropy advisory.

### 4.2 86'd Item Workflow

When an item becomes unavailable mid-service:

1. The manager or floor supervisor identifies the item is unavailable
2. Opens the operator app or web interface
3. Selects "Mark item unavailable" → selects the menu item
4. The system creates a L2 venue override that substitutes the current menu board content with a pre-rendered version that excludes or marks the unavailable item (displays "Sold out" or removes the item)
5. Override activates immediately; menu boards update within one poll cycle
6. When the item is available again, the manager clears the 86'd item override
7. Menu boards return to standard layout

For integrated deployments: steps 3–5 are triggered automatically when the POS item is marked unavailable. The operator workflow is in the POS, not in ClubHub.

### 4.3 Allergen Compliance

Allergen information on digital menu boards must be current and accurate. In jurisdictions with mandatory disclosure requirements:
- Each menu item asset must carry allergen metadata matching the current ingredient list
- When a recipe changes (reformulation, supplier change), allergen metadata must be updated simultaneously with the recipe change
- A menu board showing incorrect allergen information after a recipe change is a regulatory compliance failure
- The entropy scanner must flag menu board assets where the allergen metadata `last_updated` timestamp predates the last known recipe review date (if this data is available in the corpus)

This requirement is most relevant for chain restaurants that manage menus centrally (ENTERPRISE_ADMIN manages allergen metadata as part of the master menu corpus) and deploy to multiple venues.

---

## 5. Entropy Risk Patterns

| Content type | Entropy risk level | Detection threshold | Escalation |
|---|---|---|---|
| Menu board price divergence from POS | HIGH | At POS integration sync failure | Immediate — venue manager and operations |
| 86'd item not removed from menu board | HIGH | Operator-triggered; no automated detection | N/A (requires operator action) |
| Allergen data stale (mandatory jurisdiction) | HIGH | At asset `allergen_last_updated` age threshold | Operations team, compliance |
| Expired campaign still on menu board | MEDIUM | At campaign `valid_until` + 15 minutes | Advisory to venue operator |
| Seasonal content not updated at season boundary | MEDIUM | At seasonal calendar transition | Advisory to operator or ENTERPRISE_ADMIN |
| Window screen showing stale promotion | LOW | At campaign `valid_until` + 24 hours | Advisory |

### 5.1 POS Integration Failure

When a POS integration fails (network issue, API error, schema change), the platform continues showing the last synchronized menu board content. This is a MEDIUM entropy event: the content is not wrong (it was correct at last sync) but it may become wrong if prices change in the POS while the integration is down.

The operator must be notified immediately when the POS integration fails. The notification should tell them: what the last successful sync time was, what to do (verify prices manually, contact support). They should not have to deduce from the menu boards that something is wrong.

---

## 6. Operator Patterns

### 6.1 Restaurant Manager (Standalone and Independent)

Manages all screen content for the venue. Responsibilities:
- Daily specials management (creating and scheduling specials campaigns)
- 86'd item handling during service
- Seasonal campaign management
- Emergency handling (venue incidents)

The restaurant manager is an operator who needs functional workflows, not platform knowledge. They should be able to handle 80% of their screen management needs in under 5 minutes per day.

### 6.2 Marketing / Head Office (Chains)

ENTERPRISE_ADMIN manages the master menu corpus, campaign templates, and seasonal content at the chain level. Individual venues (VENUE_OPERATOR) activate from the enterprise library and handle daily/intra-day operational tasks. The enterprise operator never needs to think about individual venue operational decisions; the venue operator never creates master menu content.

### 6.3 Franchise Operations

Franchisors maintain L1-L3 authority over brand and menu content. Franchisees (who may be ENTERPRISE_ADMIN for their own venues) control L3–L6 for local operational content. A franchisee cannot modify the master menu board layout or pricing structure — those are franchisor-governed content at L2. A franchisee can add a local promotion (seasonal special relevant to their community) at L3.

---

## 7. Campaign Cadence

| Cadence | Sub-vertical | Typical content |
|---|---|---|
| Daily | QSR, casual | Daily specials, limited-time value promotions |
| Weekly | Casual, fine dining | Weekly chef's specials, changing menu highlights |
| Seasonal | All | Seasonal menu launches, holiday menus, annual campaigns |
| Promotional | All | Product launch campaigns (new menu item, new range), loyalty events |
| Special occasions | All | Valentine's Day, Christmas Eve, Mother's Day set menu promotions |

QSR chains often have promotional campaigns that align with franchise-wide limited-time offer (LTO) campaigns. These are created at the enterprise level and rolled out across the fleet via the standard canary promotion path — a new LTO burger, for example, would go SHADOW_ONLY → INTERNAL_CANARY → SINGLE_VENUE → FLEET_WIDE before appearing on all franchise menu boards simultaneously.

---

## 8. Operational Examples

### Example A: QSR Chain — Menu Board Price Change During Service

**Context:** Burger Republic, QSR chain, 18 venues. The enterprise marketing team has approved a price increase on the Classic Burger from $11.90 to $12.90, effective immediately. POS integration is active across all venues.

**3pm — Price updated in enterprise POS system:**
The enterprise IT team updates the Classic Burger price in the central POS configuration. The change propagates to individual venue POS terminals via the POS chain's standard sync process (typically 5 minutes for all venues).

**3pm–3:05pm — POS sync completes:**
All 18 venue POS terminals show the new price of $12.90.

**3:05pm — ClubHub POS integration sync:**
The ClubHub corpus integration detects the price change in the POS system for each venue. A corpus variable update is triggered for `classic_burger_price` across all 18 venues.

**3:05pm–3:07pm — Screen update:**
PRE resolves updated menu board content using the new corpus variable. Within two poll cycles of the corpus variable update, all 18 venues' menu boards show $12.90.

**End state:** No operator action required. No entropy event. Price is consistent between POS and menu boards across all 18 venues within approximately 7 minutes of the enterprise price update.

**Contrast — without POS integration:**
Without integration, the enterprise IT team would update the POS AND need to notify all 18 venue managers to update their ClubHub menu board assets. Human coordination at scale is unreliable — some venues would update promptly, others would miss it. A MEDIUM entropy event would be generated for any venue where the menu board price diverges from the POS price.

---

### Example B: Casual Dining — Valentine's Day Campaign

**Context:** Trattoria Vento, independent Italian restaurant. The owner is planning a Valentine's Day 3-course set menu at $95 per person. The promotion needs to appear on the window screen, the reception display, and the bar area screen for the two weeks leading up to Valentine's Day and on the day itself.

**2 weeks before Valentine's Day:**
The owner creates the Valentine's Day campaign in the operator interface. She uploads three assets:
- Window draw-in: "Valentine's Day — 3-course set menu $95pp — Book now [phone number]"
- Reception display: full set menu preview (entrée, main, dessert options)
- Bar area: ambient Valentine's Day imagery with the set menu callout

She sets the campaign targeting: window screen (SPECIFICITY_5), reception (SPECIFICITY_5), bar zone (SPECIFICITY_3 — area targeted). Validity window: February 1–14 (14 days).

**February 1:**
Campaign activates automatically. The window screen shows the Valentine's promotion. The owner does nothing.

**February 14 — Valentine's Day:**
The restaurant is fully booked. The campaign is active all day. At 10pm (service ends), the owner opens the app and deactivates the campaign early — the set menu is finished and she doesn't want the promotion continuing overnight on the window screen. She could have set `valid_until` to 10pm on February 14 at campaign creation time; she forgot. She clears it manually. 3 minutes later, the window screen returns to standard restaurant imagery.

**February 15:**
The campaign's scheduled `valid_until` (Feb 14 midnight) has passed. Even if the owner had not manually deactivated it, it would have expired at midnight. No entropy event.

---

## 9. Sub-Vertical Comparison

| Dimension | QSR | Casual Dining | Fine Dining |
|---|---|---|---|
| Menu board type | Prices, items, combos | Specials, items, specials | None (or atmospheric only) |
| Price accuracy requirement | CRITICAL | HIGH | N/A |
| POS integration recommended | YES — essential for chains | YES — recommended | N/A |
| 86'd item response time | Under 2 minutes | Under 5 minutes | N/A |
| Content complexity | Medium — structured menu boards | Medium — mix of menu and atmospheric | Low — ambient only |
| Operator frequency | Daily | Daily | Weekly or less |
| Primary entropy risk | Price divergence, item availability | Expired specials, stale seasonal | Content staleness (long cycles) |

---

## 10. Integration Points Outside PRE

| System | Interaction | Interface |
|---|---|---|
| POS system | Price changes, item availability → corpus variable updates | API integration (recommended), manual input (fallback) |
| Recipe / menu management system (chains) | Allergen metadata, menu item database → corpus content | API integration |
| Reservation system | Booking status, wait time (informational) | Manual input or API variable |
| Kitchen display system | Order status (separate system, referenced only) | NOT PRE-managed |
| Loyalty program platform | Loyalty promotions → campaign creation trigger | Manual (operator creates campaign when loyalty offer is published) |
