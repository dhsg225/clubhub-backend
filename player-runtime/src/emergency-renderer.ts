/**
 * Emergency freeze renderer.
 *
 * Constitutional rule: EMERGENCY_FREEZE overlay at z-index 9999, no dismiss button.
 * Sends WebSocket command to player-ui to activate overlay.
 */
import { WebSocketServer, WebSocket } from 'ws';

export type EmergencyCommand =
  | { type: 'EMERGENCY_FREEZE'; reason: string }
  | { type: 'EMERGENCY_CLEAR' }
  | { type: 'PLAYLIST_UPDATE'; checksum: string; screen_layout: string; zones: Record<string, unknown[]>; corpus_data: Record<string, unknown> }
  | { type: 'CONSTITUTIONAL_STATE'; state: string };

export class EmergencyRenderer {
  private readonly wss: WebSocketServer;
  private frozen = false;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      // Send current state to newly connected player-ui
      if (this.frozen) {
        this.sendToClient(ws, { type: 'EMERGENCY_FREEZE', reason: 'Reconnected during freeze' });
      }
    });
  }

  activateFreeze(reason: string): void {
    this.frozen = true;
    this.broadcast({ type: 'EMERGENCY_FREEZE', reason });
    console.log(`[emergency-renderer] EMERGENCY_FREEZE activated: ${reason}`);
  }

  clearFreeze(): void {
    // NOTE: EMERGENCY_FREEZE has no automatic exit — requires human auth token
    // This method exists for platform admin use only via explicit API call
    this.frozen = false;
    this.broadcast({ type: 'EMERGENCY_CLEAR' });
    console.log('[emergency-renderer] EMERGENCY_FREEZE cleared by authorized operator');
  }

  sendPlaylistUpdate(
    checksum: string,
    screenLayout: string,
    zones: Record<string, unknown[]>,
    corpusData: Record<string, unknown> = {},
  ): void {
    if (this.frozen) {
      console.warn('[emergency-renderer] Suppressing playlist update during EMERGENCY_FREEZE');
      return;
    }
    this.broadcast({ type: 'PLAYLIST_UPDATE', checksum, screen_layout: screenLayout, zones, corpus_data: corpusData });
  }

  sendConstitutionalState(state: string): void {
    this.broadcast({ type: 'CONSTITUTIONAL_STATE', state });
  }

  private broadcast(command: EmergencyCommand): void {
    const message = JSON.stringify(command);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private sendToClient(ws: WebSocket, command: EmergencyCommand): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(command));
    }
  }

  close(): void {
    this.wss.close();
  }
}
