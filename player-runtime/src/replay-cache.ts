/**
 * Local replay packet cache — append-only NDJSON.
 *
 * Packets are written locally and uploaded to cloud when connectivity restored.
 * NEVER mutate or delete written packets.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';
import type { ReplayPacket } from './types.js';

const CACHE_FILE = 'replay-packets.ndjson';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export class ReplayCacheWriter {
  private readonly cacheDir: string;
  private readonly filePath: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.filePath = path.join(cacheDir, CACHE_FILE);
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  /** Append a replay packet. Throws if file exceeds 50MB (alert required). */
  append(packet: ReplayPacket): void {
    // Verify packet integrity before writing
    const computedChecksum = this.computeChecksum(packet);
    if (packet.record_checksum !== computedChecksum) {
      throw new Error(`[replay-cache] Packet checksum mismatch: ${packet.packet_id}`);
    }

    const line = JSON.stringify(packet) + '\n';
    const currentSize = this.getFileSize();
    if (currentSize + line.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`[replay-cache] Cache at 50MB cap — upload required before continuing`);
    }

    fs.appendFileSync(this.filePath, line, 'utf-8');
  }

  /** Read all unsynced packets for upload. */
  readUnsynced(): ReplayPacket[] {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return content
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => JSON.parse(line) as ReplayPacket)
        .filter((p: ReplayPacket) => !p.synced);
    } catch {
      return [];
    }
  }

  getFileSize(): number {
    try {
      return fs.statSync(this.filePath).size;
    } catch {
      return 0;
    }
  }

  /** Compute record_checksum for a packet (excluding the checksum field itself). */
  static computeChecksum(packet: Omit<ReplayPacket, 'record_checksum'>): string {
    return fnv1a32(canonicalizeJson(packet)).toString(16).padStart(8, '0');
  }

  private computeChecksum(packet: ReplayPacket): string {
    const { record_checksum: _omit, ...rest } = packet;
    return fnv1a32(canonicalizeJson(rest)).toString(16).padStart(8, '0');
  }
}
