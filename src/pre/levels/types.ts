/**
 * Shared types for PRE level resolvers.
 */

import type { PlaylistItem, ResolutionLevel, ReasonTraceLevel } from '../types';

export interface LevelResult {
  playlist:         PlaylistItem[];
  terminatingLevel: ResolutionLevel;
  traceEntry:       ReasonTraceLevel;
}
