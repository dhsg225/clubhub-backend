/**
 * PRE type definitions.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §3, §4, §5, §6
 * These types define the exact input/output contract of PRE.resolve().
 *
 * IMPORTANT: These types MUST match the canonical field names used in
 * replay packets. Any change to a field name or type is a schema version
 * bump and requires corpus migration.
 */
export declare const RESOLUTION_LEVELS: {
    readonly LEVEL_0_EMERGENCY: 0;
    readonly LEVEL_1_OPERATIONAL: 1;
    readonly LEVEL_2_SCHEDULED: 2;
    readonly LEVEL_3_CAMPAIGN: 3;
    readonly LEVEL_4_SPONSORSHIP: 4;
    readonly LEVEL_5_STRUCTURAL: 5;
    readonly LEVEL_6_DEVICE_TRUTH: 6;
};
export type ResolutionLevel = typeof RESOLUTION_LEVELS[keyof typeof RESOLUTION_LEVELS];
export interface PlaylistItem {
    content_id: string;
    duration_ms: number;
    weight: number;
    /** The resolution level that produced this item */
    source: ResolutionLevel;
    /** True if this item was injected by a sponsorship contract (LEVEL_4) */
    sponsored: boolean;
}
export interface ContentMix {
    campaign_pct: number;
    sponsor_pct: number;
    override_pct: number;
    fallback_pct: number;
    system_pct: number;
}
export interface ReasonTrace {
    level_0_emergency: ReasonTraceLevel | null;
    level_1_operational: ReasonTraceLevel | null;
    level_2_scheduled: ReasonTraceLevel | null;
    level_3_campaign: ReasonTraceLevel | null;
    level_4_sponsorship: ReasonTraceSponsorshipLevel | null;
    level_5_structural: ReasonTraceLevel | null;
    level_6_device_truth: ReasonTraceDeviceTruthLevel | null;
}
export interface ReasonTraceLevel {
    /** Short code indicating what happened at this level */
    outcome: 'SKIP' | 'RESOLVED' | 'FALLBACK';
    /** Human-readable reason string (deterministic, locale-independent) */
    reason: string;
    [key: string]: unknown;
}
export interface ReasonTraceSponsorshipLevel extends ReasonTraceLevel {
    contracts_active: number;
    total_sov_pct: number;
    sov_warning_active: boolean;
    injected_items: number;
}
export interface ReasonTraceDeviceTruthLevel extends ReasonTraceLevel {
    confidence_score: number;
    last_seen_ms_ago: number;
    checksum_match: boolean;
}
export interface PRE_Output {
    screen_id: string;
    /** UTC milliseconds — the `at` value that was resolved */
    resolved_at: number;
    resolution_level: ResolutionLevel;
    /** True if this is a fallback output (no authoritative source found) */
    is_fallback: boolean;
    /** [0, 1] confidence score from LEVEL_6 annotation */
    confidence_score: number;
    /** Ordered playlist items — order defines playback sequence */
    playlist: PlaylistItem[];
    content_mix: ContentMix;
    reason_trace: ReasonTrace;
    /** FNV-1a 32-bit hex checksum of playlist content fingerprint */
    playlist_checksum: string;
    /** Monotone version counter for this screen's manifest */
    version: number;
    /** Schema version of this output structure */
    output_schema_version: '1.0.0';
}
export interface ScreenRecord {
    id: string;
    tv_group_id: string | null;
    area_id: string | null;
    venue_id: string;
    status: 'active' | 'inactive' | 'maintenance';
    last_seen_at: number | null;
    last_checksum: string | null;
}
export interface TvGroupRecord {
    id: string;
    area_id: string | null;
    name: string;
}
export interface AreaRecord {
    id: string;
    venue_id: string;
    name: string;
}
export interface VenueRecord {
    id: string;
    name: string;
    /** IANA timezone identifier — MUST be validated before use */
    timezone: string;
    is_active: boolean;
    org_id: string;
}
export interface OrganizationRecord {
    id: string;
    name: string;
}
export interface EmergencyStateRecord {
    id: string;
    venue_id: string;
    content_id: string;
    is_global: boolean;
    is_active: boolean;
    activated_at: number;
    reason: string | null;
}
export interface OverrideRecord {
    id: string;
    content_id: string;
    target_type: 'screen' | 'tv_group' | 'area' | 'venue';
    target_id: string;
    starts_at: number;
    expires_at: number | null;
    is_operational: boolean;
    priority: number;
    reason: string | null;
    issued_by: string | null;
}
export interface ScheduleRecord {
    id: string;
    campaign_id: string | null;
    content_id: string | null;
    target_type: 'screen' | 'tv_group' | 'area' | 'venue';
    target_id: string;
    specificity: number;
    starts_at: number;
    expires_at: number | null;
    days_of_week: number[];
    start_time_minutes: number | null;
    end_time_minutes: number | null;
    is_active: boolean;
    is_fallback: boolean;
    priority: number;
}
export interface CampaignRecord {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'archived';
}
export interface ContentItemRecord {
    id: string;
    duration_ms: number;
    type: string;
    is_active: boolean;
}
export interface SponsorshipContractRecord {
    id: string;
    area_id: string;
    content_id: string;
    sov_pct: number;
    starts_at: number;
    expires_at: number | null;
    is_active: boolean;
}
export interface ScreenDeliveryLogRecord {
    id: string;
    screen_id: string;
    delivered_at: number;
    checksum: string;
    resolution_level: ResolutionLevel;
}
export interface SystemStateSnapshot {
    screen: ScreenRecord;
    tv_group: TvGroupRecord | null;
    area: AreaRecord | null;
    venue: VenueRecord;
    organization: OrganizationRecord;
    emergency: EmergencyStateRecord | null;
    overrides: OverrideRecord[];
    schedules: ScheduleRecord[];
    campaigns: CampaignRecord[];
    content_items: ContentItemRecord[];
    sponsorships: SponsorshipContractRecord[];
    last_delivery: ScreenDeliveryLogRecord | null;
}
export interface PRE_Input {
    screen_id: string;
    /** UTC milliseconds — the evaluation timestamp */
    at: number;
    system_state: SystemStateSnapshot;
}
//# sourceMappingURL=types.d.ts.map