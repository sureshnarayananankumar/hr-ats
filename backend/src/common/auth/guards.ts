import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  IS_PUBLIC_KEY,
  MFA_EXEMPT_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from './decorators';
import { ACCESS_COOKIE } from '../constants';

/**
 * Verifies the access token and attaches the authenticated principal.
 *
 * Identity comes ONLY from a token this server signed. Headers such as
 * X-User-Id or X-Role are never trusted -- Kong strips them, and even if
 * one arrives it is ignored here.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      // Deliberately vague: never reveal whether a token was expired,
      // malformed or signed with the wrong key.
      throw new UnauthorizedException('Invalid or expired session');
    }

    const user: AuthenticatedUser = {
      userId: String(payload.sub),
      email: String(payload.email ?? ''),
      roles: (payload.roles as RoleName[]) ?? [],
      permissions: (payload.permissions as string[]) ?? [],
      candidateId: payload.candidateId ? String(payload.candidateId) : undefined,
      sessionId: String(payload.sid ?? ''),
      mfaSatisfied: payload.mfa === true,
    };

    // A token issued before the MFA challenge may only reach routes
    // explicitly marked @MfaExempt (the verify endpoint itself).
    const mfaExempt = this.reflector.getAllAndOverride<boolean>(MFA_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!user.mfaSatisfied && !mfaExempt) {
      throw new UnauthorizedException('Multi-factor authentication required');
    }

    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }

  /** Prefers the HTTP-only cookie; Bearer is accepted for API clients. */
  private extractToken(request: Request): string | undefined {
    const cookieToken = (request as Request & { cookies?: Record<string, string> })
      .cookies?.[ACCESS_COOKIE];
    if (cookieToken) return cookieToken;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    return undefined;
  }
}

/**
 * Enforces the permission keys declared with @RequirePermissions.
 * Runs after JwtAuthGuard, so request.user is always populated here.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length && !requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    if (requiredRoles?.length) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (!hasRole) throw new ForbiddenException('Insufficient role');
    }

    if (required?.length) {
      const granted = new Set(user.permissions);
      const missing = required.filter((permission) => !granted.has(permission));
      if (missing.length > 0) {
        // The message names the permission so operators can debug, but
        // reveals nothing about the record being protected.
        throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
      }
    }

    return true;
  }
}

/**
 * In production, refuses any request that did not arrive through Kong.
 *
 * Kong injects a shared secret header that clients cannot forge (it is
 * never sent to the browser). This closes the "bypass the gateway by
 * hitting the container directly" hole. Disabled in development so the
 * API can be exercised directly while building.
 */
@Injectable()
export class GatewayGuard implements CanActivate {
  private readonly logger = new Logger(GatewayGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.get<boolean>('isProduction')) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('security.gatewaySharedSecret');
    const received = request.headers['x-gateway-secret'];

    if (!expected || received !== expected) {
      this.logger.warn(
        `Rejected request that bypassed the gateway: ${request.method} ${request.url}`,
      );
      throw new ForbiddenException('Requests must be made through the API gateway');
    }

    return true;
  }
}
