/**
 * JWT verification and claims extraction.
 *
 * Re-exports from @clubhub/auth-types so downstream code within cms-api
 * can import from a stable local path.
 */

export {
  JWTVerificationError,
  verifyJWT,
  isUserClaims,
  isServiceClaims,
  generateDevJWT,
} from '@clubhub/auth-types';

export type {
  ClaimsPayload,
  UserClaimsPayload,
  ServiceClaimsPayload,
} from '@clubhub/auth-types';
