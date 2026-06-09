# PLAYER-TOPOLOGY.md
# ClubHub TV — Screen Player Physical and Logical Topology

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, venue integrators, platform operators
**Last updated:** 2026-05-26

---

## Table of Contents

1. [Physical Deployment](#1-physical-deployment)
2. [Player-to-Screen Mapping](#2-player-to-screen-mapping)
3. [Network Requirements](#3-network-requirements)
4. [Player Registration and Identity](#4-player-registration-and-identity)
5. [Physical Placement Patterns](#5-physical-placement-patterns)
6. [Logical Topology](#6-logical-topology)
7. [Player Modes](#7-player-modes)
8. [Player Configuration Hierarchy](#8-player-configuration-hierarchy)
9. [Player Lifecycle States](#9-player-lifecycle-states)
10. [Venue Network Topology](#10-venue-network-topology)
11. [Topology Constraints and Invariants](#11-topology-constraints-and-invariants)

---

## 1. Physical Deployment

### 1.1 Hardware Baseline

ClubHub TV screen players run on Raspberry Pi hardware. The minimum supported specification for production deployment is:

| Attribute        | Minimum                     | Recommended              |
|------------------|-----------------------------|--------------------------|
| Model            | Raspberry Pi 4 Model B      | Raspberry Pi 5           |
| RAM              | 2 GB                        | 4 GB                     |
| Storage          | 32 GB Class A1 microSD      | 64 GB Class A2 microSD   |
| OS               | Raspberry Pi OS Lite 64-bit | Raspberry Pi OS Lite 64-bit |
| Display output   | Micro-HDMI                  | Micro-HDMI (2 ports on Pi 5) |
| Network          | Gigabit Ethernet            | Gigabit Ethernet         |
| Power            | USB-C 5V/3A                 | USB-C 5V/5A              |

**Storage budget allocation (32 GB card):**
- OS + system: ~6 GB
- Player application + runtime: ~2 GB
- Local corpus (JSON): ~500 MB (generous upper bound for large enterprise)
- Local audit buffer: ~500 MB
- Content asset cache: ~20 GB operational budget
- Reserved / headroom: ~3 GB

**RAM considerations:** The PRE runs as an in-process function; it does not require dedicated RAM allocation beyond normal Node.js process overhead (~150–300 MB under normal load). The remaining RAM is available for content rendering and OS buffers. 2 GB is sufficient for single-screen operation; 4 GB is recommended for venues running intensive media or local CMS node software.

### 1.2 OS Requirements

The player application is designed for Raspberry Pi OS Lite 64-bit (Debian Bookworm base). It does not require a desktop environment. Requirements:

- Node.js 20 LTS or later (installed via NodeSource repository)
- Chromium (if browser-based content rendering is used) or a dedicated media player binary
- systemd for process supervision
- ntpd or chrony for time synchronization (critical for deterministic PRE operation — see Section 11)
- SSH enabled for remote management
- watchdog daemon enabled (hardware watchdog via `/dev/watchdog`)

The OS must be configured to start the player application on boot without operator intervention. Factory-provisioned SD cards should include the full OS image, player application, and initial corpus bootstrap bundle.

---

## 2. Player-to-Screen Mapping

### 2.1 One Player Per Screen (Standard)

The standard deployment model is one Raspberry Pi per physical screen. Each Pi drives one screen via HDMI. This model offers:

- Cleanest failure isolation: one player failure affects exactly one screen
- Simplest screen_id assignment: screen_id maps 1:1 to a physical device
- Independent PRE resolution per screen: each player resolves independently with its own `screen_id` and `at` timestamp
- No cross-player coordination at playback time

This is the required model for any screen in a zone where independent content scheduling is needed.

### 2.2 One Player Per Zone (HDMI Splitter)

A single Raspberry Pi may drive multiple physically adjacent screens using an HDMI splitter when:

- All screens in the zone must always display identical content simultaneously
- The screens are purely presentational mirrors (not independently addressable)
- The zone is configured as a single logical screen in the platform

**Critical constraint:** When using an HDMI splitter, the multiple physical screens are treated as a single `screen_id` in the platform. They cannot be independently scheduled. If per-screen scheduling is ever needed in the future, this requires a hardware upgrade to individual players. This decision is effectively irreversible at the time of deployment and must be explicitly acknowledged by the VENUE_ADMIN before commission.

**HDMI splitter note:** Only passive splitters that clone the signal are supported. Managed matrix switches that split content across different outputs are not equivalent to the standard 1:1 model and require custom integration.

### 2.3 One Player Per Zone (Multi-Output, Pi 5)

Raspberry Pi 5 supports two Micro-HDMI outputs. Both outputs can be used to drive two independent screens from a single device when those screens are in the same physical zone and share an identical schedule.

This is not a recommended topology for new deployments because it creates a single point of failure for two screens. It may be appropriate for cost-constrained small venues where both screens are in the same room and simultaneous failure is acceptable.

When deployed in this mode, the two physical screens still share a single `screen_id` — they are one logical screen to the platform.

---

## 3. Network Requirements

### 3.1 Venue LAN Requirements

Each player must have a stable local area network connection within the venue. Requirements:

| Requirement            | Specification                                              |
|------------------------|------------------------------------------------------------|
| Physical connection    | Ethernet preferred; Wi-Fi permitted with caveats (see below) |
| IP assignment          | Static IP or stable DHCP reservation strongly recommended  |
| LAN bandwidth          | 100 Mbps minimum; 1 Gbps preferred                         |
| LAN latency to router  | <5 ms                                                      |
| Firewall               | Player must be able to initiate outbound TCP connections    |

**Wi-Fi caveats:** Wi-Fi is acceptable for corpus sync and telemetry (small payloads, tolerant of brief outages). It is not recommended for primary content delivery in venues where large asset transfers are frequent. Wi-Fi introduces additional entropy risk: a player that cannot download assets reliably may have an incomplete local asset cache, blocking campaign readiness. Ethernet is strongly preferred for all production deployments.

### 3.2 WAN Requirements

WAN connectivity enables corpus synchronization, audit record batching, and entropy metric reporting to the cloud CMS. Players operate fully autonomously without WAN (see EDGE-BEHAVIOR.md), but WAN connectivity is required for:

- Receiving updated corpus versions
- Submitting replay audit records to the cloud store
- Receiving emergency signals (EMERGENCY_FREEZE propagation)
- Reporting entropy metrics for platform-level analysis

| Requirement         | Specification                                               |
|---------------------|-------------------------------------------------------------|
| Protocol            | HTTPS (TLS 1.2+)                                            |
| Minimum bandwidth   | 1 Mbps sustained (sufficient for corpus sync and metrics)   |
| Asset download      | 10 Mbps recommended for timely asset prefetch               |
| Fallback            | 4G/LTE USB modem as WAN backup is supported                 |
| DNS                 | Player requires DNS resolution of CMS endpoint FQDN         |

Players must be able to reach the CMS sync endpoint on HTTPS (port 443). No other inbound ports are required on the player. All connections are player-initiated.

### 3.3 Port and Firewall Requirements (Player Outbound)

| Destination           | Port | Protocol | Purpose                        |
|-----------------------|------|----------|--------------------------------|
| CMS sync endpoint     | 443  | HTTPS    | Corpus version check and sync  |
| CMS audit endpoint    | 443  | HTTPS    | Replay audit batch upload      |
| CMS emergency channel | 443  | WSS      | Real-time emergency signals    |
| Asset CDN             | 443  | HTTPS    | Asset download and prefetch    |
| NTP server            | 123  | UDP      | Time synchronization           |

No inbound ports are required to be open on the player for normal operation. Remote management (SSH) should be restricted to the venue LAN or accessed via a bastion host — it must not be exposed to the public internet.

---

## 4. Player Registration and Identity

### 4.1 Device Identity

Each player has a stable device identity established at first boot. The identity consists of:

- **device_fingerprint:** Derived from hardware serial number, MAC address (Ethernet interface), and a per-provisioning salt. This fingerprint is deterministic for a given piece of hardware and cannot be changed without factory reset.
- **screen_id:** The platform identifier assigned to this player by the CMS during registration. screen_id is a UUID and is stored in the player's identity file (`/etc/clubhub/identity.json`). This is the identifier used in all PRE invocations.
- **venue_id:** The venue this player belongs to. Set during registration and not changeable without deregistration.
- **registration_token:** A one-time token generated by the ENTERPRISE_ADMIN or VENUE_ADMIN in the CMS, used to authenticate the initial registration request. Expires after 24 hours.

### 4.2 Registration Flow

```
[ENTERPRISE_ADMIN or VENUE_ADMIN]
    |
    | Creates screen record in CMS
    | → CMS generates registration_token (one-time, 24h TTL)
    |
    v
[Pi player — first boot]
    |
    | Reads registration_token from provisioning config
    | Sends POST /api/devices/register with device_fingerprint + registration_token
    |
    v
[CMS]
    |
    | Validates token (not expired, not already used)
    | Binds device_fingerprint to screen_id
    | Returns: screen_id, corpus_endpoint, audit_endpoint, emergency_endpoint
    |
    v
[Pi player]
    |
    | Writes identity.json: {screen_id, venue_id, device_fingerprint, endpoints}
    | Proceeds to corpus load (lifecycle state: REGISTERED → CORPUS_LOADING)
```

Registration tokens are single-use. A token that has been consumed cannot register a second device. If a device is replaced, the old screen record must be deregistered before a new registration token can be issued for that screen_id.

### 4.3 Re-Registration (Device Replacement)

When a Pi is replaced (hardware failure, theft, upgrade):

1. VENUE_ADMIN marks the old device as DECOMMISSIONED in the CMS
2. CMS invalidates the old device_fingerprint binding
3. VENUE_ADMIN issues a new registration_token for the same screen_id
4. New Pi registers using the new token, binding its new device_fingerprint to the existing screen_id
5. Corpus is delivered to the new device; it enters CORPUS_LOADING → OPERATIONAL

The screen_id is preserved across the hardware replacement. Historical audit records remain associated with the screen_id and are not affected by the device change.

---

## 5. Physical Placement Patterns

### 5.1 Behind-Screen Mount

The player is mounted directly behind the screen on a VESA bracket or adhesive mount. HDMI cable runs directly from Pi to screen (typically <0.5 m). Power is drawn from a wall outlet behind the screen or from a screen's USB port (if it provides sufficient current).

**Advantages:** Minimal cabling, clean installation, easy to locate for maintenance.
**Disadvantages:** Ambient heat from screen electronics; limited ventilation may require active cooling; difficult to access without moving the screen.

**Ventilation requirement:** Pi must have at least 5 cm clearance on all sides or a dedicated heatsink case. Operating temperature must remain below 80°C (thermal throttling begins). Raspberry Pi 5 requires active cooling even in normal ambient temperatures.

### 5.2 AV Rack Mount

The player is installed in an AV equipment rack, typically in a back-of-house location. HDMI cables run from the rack to the screens (may be 5–30 m; active HDMI cables or HDMI extenders over Cat6 required for runs >5 m).

**Advantages:** Better cooling, easier physical access, centralized management of multiple players, no screen-mounted hardware visible.
**Disadvantages:** Longer cable runs; requires AV-grade HDMI extenders for distance; rack space and power distribution required.

**For deployments with >4 screens at a single venue:** AV rack placement is strongly recommended. This pattern scales to 50+ screens with a managed Ethernet switch and structured cabling.

### 5.3 Server Room

For large venue complexes (resorts, stadiums), players may be deployed in a dedicated server room or telecommunications room. All network and power infrastructure is centralized. HDMI over IP (HDBaseT or similar) may be used to distribute content to screens across the venue.

**Note:** HDMI over IP solutions introduce additional latency and complexity. The platform does not manage the HDMI transport layer — this is handled by the AV infrastructure. The Pi still operates as a standard player; only the display output path changes.

---

## 6. Logical Topology

### 6.1 Screen Hierarchy

Every screen in the platform exists within a strict four-level hierarchy:

```
enterprise
  └── venue
        └── screen_zone
              └── screen (screen_id)
```

- **enterprise:** The top-level tenant. May be a hotel group, pub group, club chain, or single-venue operator. All screens in an enterprise share the same corpus authority boundary.
- **venue:** A physical location. Screens within a venue share corpus version deployment (canary promotion targets venues as the minimum rollout unit). A venue may have 1 to 50+ screens.
- **screen_zone:** A named grouping of screens within a venue (e.g., "Main Bar", "Reception", "Poolside"). Zones are used for targeted scheduling and content differentiation within a venue.
- **screen (screen_id):** The leaf unit. Each screen_id maps to exactly one physical player (or one logical player driving multiple mirrored screens via HDMI splitter).

### 6.2 Player Cluster

Multiple players at the same venue form a player cluster. Within a cluster:

- Each player operates entirely independently — there is no peer-to-peer communication between players
- All players in the cluster receive the same corpus version (venue is the minimum canary rollout unit)
- Each player resolves PRE independently using its own screen_id and locally-read timestamp
- correlation_ids are generated independently per player per invocation — there is no cluster-level correlation_id
- A single player failure does not affect any other player in the cluster

The "cluster" concept is primarily a scheduling and corpus-delivery abstraction, not a runtime coordination mechanism. At invocation time, each player is fully autonomous.

---

## 7. Player Modes

A player operates in one of four runtime modes at any given time:

| Mode                | Description                                                                                             |
|---------------------|---------------------------------------------------------------------------------------------------------|
| `ACTIVE`            | Player is serving PRE output normally. Corpus is loaded, verified, and current. All systems nominal.   |
| `STANDBY`           | Player is running but corpus is not yet loaded or is being verified. Screen displays a standby state. This mode is transient on initial registration or corpus update. |
| `OFFLINE`           | Player has lost WAN connectivity. Continuing to serve PRE output from last verified local corpus. Audit records buffered locally. |
| `EMERGENCY_FALLBACK` | EMERGENCY_FREEZE state is active. PRE invocations are halted. Screen displays device-local cached fallback content. This mode is authoritative — no PRE resolution occurs until EMERGENCY_FREEZE is lifted by PLATFORM_ADMIN. |

**Mode transitions:**

```
ACTIVE <----> OFFLINE        (WAN connectivity loss/restore — automatic)
ACTIVE -----> EMERGENCY_FALLBACK   (EMERGENCY_FREEZE received — automatic)
EMERGENCY_FALLBACK --> ACTIVE      (EMERGENCY_FREEZE lifted — requires PLATFORM_ADMIN action)
STANDBY ----> ACTIVE         (corpus verification complete — automatic)
ACTIVE ----> STANDBY         (new corpus version applying — transient)
```

A player never self-heals from EMERGENCY_FALLBACK. This is by design. The EMERGENCY_FREEZE state requires an explicit human decision (PLATFORM_ADMIN or authorized ENTERPRISE_ADMIN) to lift. Automatic recovery from an emergency is constitutionally prohibited.

---

## 8. Player Configuration Hierarchy

Configuration is applied in layers, with more specific layers overriding less specific ones. The precedence order (lowest to highest specificity):

```
1. Platform-level defaults
       |
       v (overridden by)
2. Enterprise-level configuration
       |
       v (overridden by)
3. Venue-level configuration
       |
       v (overridden by)
4. Screen-zone-level configuration
       |
       v (overridden by)
5. Per-screen overrides (rare)
```

**Platform-level defaults** are set by PLATFORM_ADMIN and define system-wide behavior: default polling intervals, emergency fallback content references, global compliance rules, audit retention periods.

**Enterprise-level configuration** sets brand standards, content policies, and campaign targeting rules that apply across all venues under the enterprise.

**Venue-level configuration** handles venue-specific operating hours, local compliance requirements (e.g., gaming commission rules for a specific state/territory), venue timezone, and local override policies.

**Screen-zone-level configuration** targets content by zone: what content categories are appropriate for bar zone vs. family dining zone, volume settings for zones with audio, daypart rules specific to a zone.

**Per-screen overrides** are used sparingly. Examples of legitimate uses: a screen in a legal zone that requires specific compliance messaging not needed by other screens; a screen with a non-standard aspect ratio requiring a specific content template; a screen permanently reserved for a single sponsor.

**Important:** The corpus package delivered to each player contains the fully resolved configuration for that player. Players do not hold a layered configuration model locally — they hold the resolved flat corpus that is the output of the CMS merging all applicable layers. The hierarchy is a CMS authoring concept, not a player runtime concept.

---

## 9. Player Lifecycle States

### 9.1 State Machine

```
UNREGISTERED
    |
    | (registration_token consumed, device_fingerprint bound)
    v
REGISTERED
    |
    | (corpus bundle downloaded and checksum verified)
    v
CORPUS_LOADED
    |
    | (PRE invoked successfully, first valid output produced)
    v
OPERATIONAL
    |
    | (VENUE_ADMIN or ENTERPRISE_ADMIN marks screen as decommissioned)
    v
DECOMMISSIONED
```

| State            | Description                                                                         |
|------------------|-------------------------------------------------------------------------------------|
| `UNREGISTERED`   | Pi has been provisioned but has not yet completed the registration handshake with CMS. No screen_id assigned. |
| `REGISTERED`     | Device identity established, screen_id assigned. Player is downloading and verifying corpus. |
| `CORPUS_LOADED`  | Corpus downloaded and checksum verified. Player is ready to invoke PRE. A first test invocation is performed to confirm PRE executes correctly before transitioning to OPERATIONAL. |
| `OPERATIONAL`    | Normal operating state. PRE is being invoked and output served. |
| `DECOMMISSIONED` | Screen has been retired. Player is no longer expected to check in. Audit records are archived. |

### 9.2 Transitions on Screen Replacement

When a screen is physically replaced at a venue:

1. Old player enters DECOMMISSIONED (manual action in CMS by VENUE_ADMIN)
2. New player provisions with a new registration_token issued for the same screen_id
3. New player completes UNREGISTERED → REGISTERED → CORPUS_LOADED → OPERATIONAL
4. Historical audit records associated with screen_id remain intact and reference the screen_id, not the device_fingerprint

This means that the screen_id is the stable operational identity of a screen position in the venue. Physical hardware is interchangeable behind a screen_id.

---

## 10. Venue Network Topology

### 10.1 Standard Venue (WAN-connected)

```
[Cloud CMS / Sync Server]
         |
         | HTTPS (WAN)
         |
[Venue Router / Gateway]
         |
         | (venue LAN — Ethernet switch)
         |
    +----|----+----+----+
    |         |         |
[Player 1] [Player 2] [Player 3]
    |         |         |
[Screen 1] [Screen 2] [Screen 3]
```

Each player communicates directly with the CMS over WAN. Players do not communicate with each other. The venue router provides NAT and outbound internet access.

### 10.2 Large Venue (Managed Switch)

For venues with >8 screens:

```
[Cloud CMS / Sync Server]
         |
         | HTTPS (WAN)
         |
[Venue Router / Gateway]
         |
[Managed Ethernet Switch]
    |    |    |    |    |    |
   P1   P2   P3   P4   P5   P6  ... (up to 50+ players)
```

The managed switch provides:
- VLAN isolation for player traffic (recommended: separate VLAN from guest Wi-Fi and POS systems)
- QoS prioritization for emergency channel traffic
- Port-level visibility for network troubleshooting

### 10.3 Air-Gapped Venue (No WAN)

Some venues have no reliable WAN connectivity. These venues operate in permanent OFFLINE mode with manual corpus updates:

```
[USB/Local Media] ---> [Player 1]
                  ---> [Player 2]
                  ---> [Player n]
```

Air-gapped operation requires GRADE_A venue autonomy classification (see VENUE-AUTONOMY.md). Corpus packages are prepared by ENTERPRISE_ADMIN, signed, and delivered via physical media (USB) or a local file server. See OFFLINE-OPERATION.md for the full procedure.

---

## 11. Topology Constraints and Invariants

These constraints must be satisfied at all times. Violation of any constraint is a platform defect.

**T-1: Unique screen_id per physical player**
A screen_id must be bound to exactly one active device_fingerprint at any given time. A device that has been deregistered cannot share its old screen_id with another active device.

**T-2: Time synchronization is a prerequisite for correctness**
PRE uses the `at` parameter (UTC millisecond timestamp) as a resolution input. If a player's clock is wrong, PRE will produce incorrect output — correct by PRE's logic, but wrong for the actual current time. All players must run NTP and must refuse to enter OPERATIONAL state if clock synchronization has not been confirmed. Clock drift >1 second requires investigation; drift >30 seconds is a hard operational fault.

**T-3: Player resolution is always local**
No PRE invocation may depend on a real-time network call. The corpus is local. The timestamp is local. The resolution is local. If a player cannot resolve PRE without a network call, the player's corpus loading procedure has failed.

**T-4: Corpus integrity is verified before application**
A player must not run PRE against an unverified corpus. Every corpus package has a checksum. The checksum must be verified before the corpus is considered LOADED. A corrupted or incomplete corpus must be rejected and re-downloaded.

**T-5: No peer-to-peer coordination at invocation time**
Players never communicate with each other. Content synchronization across screens at a venue is achieved by loading identical corpus versions, not by runtime coordination. If two screens appear to be out of sync, the root cause is corpus entropy, not a coordination failure.

**T-6: EMERGENCY_FALLBACK requires explicit human lift**
A player that has entered EMERGENCY_FALLBACK mode will not exit it autonomously. It will remain in EMERGENCY_FALLBACK until it receives an authenticated EMERGENCY_FREEZE_LIFT signal from the CMS. This signal requires PLATFORM_ADMIN authority to issue.
