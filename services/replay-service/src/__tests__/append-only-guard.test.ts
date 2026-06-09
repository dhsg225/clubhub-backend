import { describe, it, expect } from 'vitest';
import { assertAppendOnly, AppendOnlyViolationError } from '../append-only-guard.js';

describe('AppendOnlyGuard', () => {
  it('throws AppendOnlyViolationError for DELETE', () => {
    expect(() => assertAppendOnly('DELETE', 'record-001')).toThrow(AppendOnlyViolationError);
  });

  it('throws AppendOnlyViolationError for UPDATE', () => {
    expect(() => assertAppendOnly('UPDATE', 'record-001')).toThrow(AppendOnlyViolationError);
  });

  it('error message names the operation and record', () => {
    expect(() => assertAppendOnly('DELETE', 'record-xyz')).toThrow(/DELETE.*record-xyz/);
  });
});
