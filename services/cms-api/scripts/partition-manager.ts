/**
 * Partition manager: creates next month's partitions for all partitioned tables.
 * Run this as a monthly cron job.
 *
 * Constitutional: partitions must exist before records are inserted.
 * This script must run on the 25th of each month to create next month's partition.
 */
import { emit, base } from '@clubhub/telemetry-sdk';

export function getNextMonthPartitionBounds(): {
  tableSuffix: string;
  fromDate: string;
  toDate: string;
} {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  const pad = (n: number): string => String(n).padStart(2, '0');

  return {
    tableSuffix: `${nextMonth.getFullYear()}_${pad(nextMonth.getMonth() + 1)}`,
    fromDate: `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`,
    toDate: `${monthAfter.getFullYear()}-${pad(monthAfter.getMonth() + 1)}-01`,
  };
}

export function generatePartitionSQL(bounds: ReturnType<typeof getNextMonthPartitionBounds>): string {
  const { tableSuffix, fromDate, toDate } = bounds;
  return `
-- Auto-generated partition SQL for ${tableSuffix}
CREATE TABLE IF NOT EXISTS replay_audit_records_${tableSuffix}
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('${fromDate}') TO ('${toDate}');

CREATE TABLE IF NOT EXISTS parity_records_${tableSuffix}
  PARTITION OF parity_records
  FOR VALUES FROM ('${fromDate}') TO ('${toDate}');

CREATE TABLE IF NOT EXISTS canary_stage_history_next
  PARTITION OF canary_stage_history
  FOR VALUES FROM ('${fromDate}') TO ('${toDate}');
  `.trim();
}
