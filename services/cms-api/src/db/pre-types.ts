/**
 * PRE type declarations for cms-api database layer.
 *
 * These mirror src/pre/types.ts at the monorepo root.
 * They are declared here to avoid cross-rootDir compilation issues.
 *
 * CONSTITUTIONAL: These types MUST remain identical to src/pre/types.ts.
 * Any divergence is a critical bug.
 */

export type ResolutionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScreenRecord {
  id: string;
  tv_group_id: string | null;
  area_id: string | null;
  venue_id: string;
  status: 'active' | 'inactive' | 'maintenance';
  last_seen_at: number | null;  // UTC ms
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
  activated_at: number;  // UTC ms
  reason: string | null;
}

export interface OverrideRecord {
  id: string;
  content_id: string;
  target_type: 'screen' | 'tv_group' | 'area' | 'venue';
  target_id: string;
  starts_at: number;        // UTC ms
  expires_at: number | null; // UTC ms; null = permanent
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
  starts_at: number;        // UTC ms
  expires_at: number | null; // UTC ms
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
  sov_pct: number;   // share-of-voice percentage [0,1]
  starts_at: number; // UTC ms
  expires_at: number | null;
  is_active: boolean;
}

export interface ScreenDeliveryLogRecord {
  id: string;
  screen_id: string;
  delivered_at: number;  // UTC ms
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

export interface PlaylistItem {
  content_id: string;
  duration_ms: number;
  weight: number;
  source: ResolutionLevel;
  sponsored: boolean;
}

export interface PRE_Output {
  screen_id: string;
  resolved_at: number;
  resolution_level: ResolutionLevel;
  is_fallback: boolean;
  confidence_score: number;
  playlist: PlaylistItem[];
  playlist_checksum: string;
  version: number;
  output_schema_version: '1.0.0';
}
