/**
 * Express authentication middleware.
 *
 * Attaches verified RequestIdentity to req.identity.
 * Constitutional enforcement: SPONSOR_STAKEHOLDER routed to separate nav model.
 */

import type { Request, Response, NextFunction } from 'express';
import type { RequestIdentity, UserRole, Permission } from '@clubhub/auth-types';
import { verifyJWT, isUserClaims, isServiceClaims, JWTVerificationError } from './jwt.js';
import { hasPermission } from './roles.js';
import { randomUUID } from 'node:crypto';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      identity?: RequestIdentity;
    }
  }
}

/**
 * Extract and verify JWT from Authorization header.
 * Attaches identity to req.identity.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const claims = verifyJWT(token);
    const correlationId = (req.headers['x-correlation-id'] as string | undefined)
      ?? randomUUID();

    if (isUserClaims(claims)) {
      req.identity = {
        user_id: claims.sub,
        scope: 'USER',
        role: claims.role,
        service_name: null,
        tenant: claims.tenant,
        correlation_id: correlationId,
      };
    } else if (isServiceClaims(claims)) {
      req.identity = {
        user_id: claims.sub,
        scope: 'SERVICE',
        role: null,
        service_name: claims.service_name,
        tenant: { enterprise_id: null, regional_org_id: null, venue_id: null },
        correlation_id: correlationId,
      };
    }

    next();
  } catch (err) {
    if (err instanceof JWTVerificationError) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}

/**
 * Require a specific permission. Must be called after requireAuth.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identity = req.identity;
    if (!identity) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    // SERVICE scope: check specific service permissions (not role-based)
    if (identity.scope === 'SERVICE') {
      // Service accounts have specific allowed operations — not role-based
      // For now: SERVICE scope cannot trigger emergency or advance canary
      const forbiddenForService: Permission[] = ['emergency_trigger', 'canary_advance'];
      if (forbiddenForService.includes(permission)) {
        res.status(403).json({ error: 'SERVICE scope cannot perform this operation' });
        return;
      }
      next();
      return;
    }

    // USER scope: role-based permission check
    if (!identity.role || !hasPermission(identity.role, permission)) {
      res.status(403).json({
        error: `Insufficient permissions: requires ${permission}`,
        your_role: identity.role,
      });
      return;
    }

    next();
  };
}

/**
 * Require a specific role. Must be called after requireAuth.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identity = req.identity;
    if (!identity || !identity.role) {
      res.status(401).json({ error: 'Unauthenticated or non-human scope' });
      return;
    }

    if (!roles.includes(identity.role)) {
      res.status(403).json({
        error: `Requires role: ${roles.join(' or ')}`,
        your_role: identity.role,
      });
      return;
    }

    next();
  };
}

/**
 * Require human authorization token for constitutional operations.
 * Used for: EMERGENCY_FREEZE exit, canary advancement.
 *
 * Constitutional rule: token must be >= 8 characters.
 */
export function requireHumanAuthToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-human-auth-token'] as string | undefined;

  if (!token || token.length < 8) {
    res.status(403).json({
      error: 'Human authorization token required (X-Human-Auth-Token header, >= 8 chars)',
      constitutional_rule: 'EMERGENCY_FREEZE exit and canary advancement require human auth token',
    });
    return;
  }

  next();
}
