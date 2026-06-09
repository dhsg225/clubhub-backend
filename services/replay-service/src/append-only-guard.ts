/**
 * Append-only guard for replay audit service.
 *
 * Constitutional: replay audit records are IMMUTABLE.
 * This guard is in addition to the PostgreSQL DELETE trigger.
 * Defense in depth: both layers must be active.
 */
import { emit, base } from '@clubhub/telemetry-sdk';

export class AppendOnlyViolationError extends Error {
  constructor(operation: string, recordId: string) {
    super(
      `CONSTITUTIONAL VIOLATION: Attempted ${operation} on replay audit record ${recordId}. ` +
      'Replay audit records are append-only and immutable.',
    );
    this.name = 'AppendOnlyViolationError';
  }
}

export function assertAppendOnly(operation: 'UPDATE' | 'DELETE', recordId: string): never {
  emit({
    ...base('ERROR', 'replay_service.append_only_violation'),
    operation,
    record_id: recordId,
    severity_class: 4, // CLASS_4: constitutional violation
  } as Parameters<typeof emit>[0]);
  throw new AppendOnlyViolationError(operation, recordId);
}

/**
 * Wrap a handler to reject DELETE and UPDATE operations at the application layer.
 * The DB trigger is the primary enforcement; this is defense-in-depth.
 */
export function guardAppendOnly<T>(
  operation: string,
  handler: () => Promise<T>,
): Promise<T> {
  const op = operation.toUpperCase();
  if (op === 'DELETE' || op === 'UPDATE') {
    assertAppendOnly(op as 'DELETE' | 'UPDATE', 'unknown');
  }
  return handler();
}
