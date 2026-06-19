/**
 * Player UI — Chromium kiosk renderer
 *
 * Renders resolved playlists from player-runtime via WebSocket.
 * No CMS connectivity — talks only to local player-runtime on ws://localhost:7777.
 *
 * Constitutional constraint: emergency overlay cannot be suppressed by playlist logic.
 */

// Dev test (no Pi required): set PLAYER_UI_DIR=/path/to/apps/player-ui in player-runtime
// env, start player-runtime, then open http://localhost:3001 in a browser.
// WebSocket connects to ws://localhost:7777.

import { renderPlaylist, showWaiting } from './playlist-renderer.js';

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
        case 'PLAYLIST_UPDATE': {
          const items = (msg.items ?? []) as PlaylistItem[];
          if (items.length === 0) {
            showWaiting();
          } else {
            renderPlaylist(items);
          }
          console.log(`[player-ui] Playlist updated checksum=${msg.checksum ?? 'unknown'} items=${items.length}`);
          break;
        }
        case 'EMERGENCY_FREEZE': {
          const titleEl = document.getElementById('emergency-title');
          const messageEl = document.getElementById('emergency-message');
          if (titleEl) titleEl.textContent = 'EMERGENCY';
          if (messageEl) messageEl.textContent = msg.reason ?? 'Facility emergency in progress';
          if (overlay) overlay.style.display = 'flex';
          console.log(`[player-ui] EMERGENCY_FREEZE activated: ${msg.reason ?? ''}`);
          break;
        }
        case 'EMERGENCY_CLEAR':
          if (overlay) overlay.style.display = 'none';
          // Do NOT clear textContent — child elements must survive for next FREEZE
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

showWaiting();
connectToRuntime();
