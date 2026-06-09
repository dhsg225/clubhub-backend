/**
 * PRE Engine — Playback Resolution Engine
 *
 * Re-exports the full PRE implementation from src/pre/index.ts.
 * This package provides the workspace-scoped entry point for services.
 *
 * Constitutional rule: this package MUST NOT import @clubhub/telemetry-sdk (FP-21).
 */
// CJS→ESM interop: named import fails static analysis in Node.js v20.
// Use namespace import and re-export explicitly.
import * as _preCore from '../../../src/pre/index.js';
export const resolve = (_preCore as unknown as { resolve: typeof import('../../../src/pre/index.js')['resolve'] }).resolve;
export type {
  PRE_Input,
  PRE_Output,
  SystemStateSnapshot,
  PlaylistItem,
  ScreenRecord,
  VenueRecord,
  TvGroupRecord,
  AreaRecord,
  OrganizationRecord,
  EmergencyStateRecord,
  OverrideRecord,
  ScheduleRecord,
  CampaignRecord,
  ContentItemRecord,
  SponsorshipContractRecord,
  ScreenDeliveryLogRecord,
  ResolutionLevel,
  ContentMix,
  ReasonTrace,
} from '../../../src/pre/types.js';
