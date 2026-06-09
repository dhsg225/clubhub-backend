/**
 * Player UI — Chromium kiosk renderer
 *
 * Renders resolved playlists from player-runtime via WebSocket.
 * No CMS connectivity — talks only to local player-runtime on ws://localhost:7777.
 *
 * Constitutional constraint: emergency overlay cannot be suppressed by playlist logic.
 */

import { renderPlaylist } from './playlist-renderer.js';

const WS_URL = 'ws://localhost:7777';

interface PlaylistItem {
  content_id: string;
  duration_ms: number;
  asset_path: string;
  weight?: number;
  source?: number;
  sponsored?: boolean;
}

function connectToRuntime(): void {
  const ws = new WebSocket(WS_URL);
  const overlay = document.getElementById('emergency-overlay') as HTMLElement | null;

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        type: string;
        checksum?: string;
        items?: unknown[];
        reason?: string;
        state?: string;
      };

      switch (msg.type) {
        case 'PLAYLIST_UPDATE':
          if (msg.items) {
            renderPlaylist(msg.items as PlaylistItem[]);
            console.log(`[player-ui] Playlist updated checksum=${msg.checksum ?? 'unknown'}`);
          }
          break;
        case 'EMERGENCY_FREEZE':
          if (overlay) {
            overlay.style.display = 'flex';
            overlay.textContent = `EMERGENCY: ${msg.reason ?? 'Facility emergency in progress'}`;
          }
          console.log(`[player-ui] EMERGENCY_FREEZE activated: ${msg.reason ?? ''}`);
          break;
        case 'EMERGENCY_CLEAR':
          if (overlay) {
            overlay.style.display = 'none';
            overlay.textContent = '';
          }
          console.log('[player-ui] EMERGENCY_FREEZE cleared');
          break;
        case 'CONSTITUTIONAL_STATE':
          console.log(`[player-ui] Constitutional state: ${msg.state ?? 'UNKNOWN'}`);
          break;
        default:
          // unknown message type — ignore
          break;
      }
    } catch (err) {
      console.error('[player-ui] Message parse error:', err);
    }
  };

  ws.onclose = () => {
    // Retry after 5s — continue rendering last playlist during disconnect
    setTimeout(connectToRuntime, 5000);
  };
}

connectToRuntime();
