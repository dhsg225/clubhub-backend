/**
 * WebSocket-driven constitutional state synchronization.
 * Must be mounted near the app root — drives ConstitutionalStateOverlay.
 */
import { useEffect } from 'react';
import { useConstitutionalStore } from '../../stores/constitutionalStore.js';
import type { ConstitutionalState } from '@clubhub/constitutional-types';

const WS_URL = (import.meta.env['VITE_WS_URL'] as string | undefined) ?? (() => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/constitutional`;
})();

export function WebSocketConstitutionalSync(): null {
  const setConstitutionalState = useConstitutionalStore((s) => s.setConstitutionalState);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect(): void {
      ws = new WebSocket(WS_URL);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: 'constitutional_state';
            state: ConstitutionalState;
            reason: string | null;
          };
          if (msg.type === 'constitutional_state') {
            setConstitutionalState(msg.state, msg.reason);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        // Retry connection — constitutional state updates are critical
        reconnectTimeout = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      ws?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [setConstitutionalState]);

  return null;
}
