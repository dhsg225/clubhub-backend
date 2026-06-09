/**
 * Local audit ring buffer for Pi player.
 *
 * Constitutional:
 * - Append-only: never overwrites or deletes buffered records
 * - Max 50MB: alerts when approaching capacity
 * - Flushes to cloud on sync
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { emit, base } from '@clubhub/telemetry-sdk';

const MAX_BUFFER_BYTES = 50 * 1024 * 1024; // 50MB
const ALERT_THRESHOLD = 0.7; // 70%

export class AuditBuffer {
  private readonly bufferPath: string;
  private writeStream: fs.WriteStream;

  constructor(dataDir: string) {
    this.bufferPath = path.join(dataDir, 'audit-buffer.ndjson');
    this.writeStream = fs.createWriteStream(this.bufferPath, { flags: 'a' });
  }

  append(record: Record<string, unknown>): void {
    const line = JSON.stringify(record) + '\n';
    this.writeStream.write(line);
    this.checkCapacity();
  }

  private checkCapacity(): void {
    try {
      const stats = fs.statSync(this.bufferPath);
      const ratio = stats.size / MAX_BUFFER_BYTES;
      if (ratio > ALERT_THRESHOLD) {
        emit({
          ...base('WARN', 'audit_buffer.capacity_warning'),
          buffer_bytes: stats.size,
          max_bytes: MAX_BUFFER_BYTES,
          ratio,
        } as Parameters<typeof emit>[0]);
      }
    } catch {
      // file might not exist yet
    }
  }

  async readAll(): Promise<string[]> {
    try {
      const content = fs.readFileSync(this.bufferPath, 'utf-8');
      return content.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async truncateDelivered(deliveredCount: number): Promise<void> {
    const lines = await this.readAll();
    const remaining = lines.slice(deliveredCount);
    fs.writeFileSync(this.bufferPath, remaining.join('\n') + (remaining.length > 0 ? '\n' : ''));
    emit({ ...base('INFO', 'audit_buffer.truncated'), delivered: deliveredCount, remaining: remaining.length } as Parameters<typeof emit>[0]);
  }
}
