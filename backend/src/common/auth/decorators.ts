import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import type { PermissionKey } from './permissions';

export const IS_PUBLIC_KEY = 'hr-ats:isPublic';
export const PERMISSIONS_KEY = 'hr-ats:permissions';
export const ROLES_KEY = 'hr-ats:roles';
export const MFA_EXEMPT_KEY = 'hr-ats:mfaExempt';

/**
 * Marks a route as reachable without authentication.
 * Used only by the careers portal, auth endpoints and health checks.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires ALL listed permissions. This is the primary authorization
 * mechanism -- never rely on the frontend hiding a menu item.
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Requires ANY of the listed roles. Prefer RequirePermissions. */
export const RequireRoles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);

/** Allows a half-authenticated (pre-MFA) token through, e.g. /auth/mfa/verify. */
export const MfaExempt = () => SetMetadata(MFA_EXEMPT_KEY, true);

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: RoleName[];
  permissions: string[];
  /** Present only for users who have a candidate profile. */
  candidateId?: string;
  sessionId: string;
  /** False while the user still owes an MFA challenge. */
  mfaSatisfied: boolean;
}

/**
 * Injects the verified user built by JwtAuthGuard.
 * The payload comes from a signed token the server issued -- never from
 * a client-supplied header such as X-User-Id.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    return field && user ? user[field] : user;
  },
);

/** The Kong-issued correlation id, for tying API logs to gateway logs. */
export const RequestId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.id ?? request.headers['x-request-id'];
});
