import { createHash } from 'crypto';
import { canonicalJSON } from './canonical-json';

/** SHA-256 of a raw string. Returns lowercase hex. */
export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/** SHA-256 of the canonical JSON serialization of an object. */
export function hashObject(obj: unknown): string {
  return sha256(canonicalJSON(obj));
}
