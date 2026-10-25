import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER } from '../constants';
import { safeCompare } from '../utils/crypto.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit-cookie CSRF protection.
 *
 * The attack this stops: a third-party site causes the browser to issue
 * a state-changing request, and the browser helpfully attaches our
 * HTTP-only session cookie. The defence is that the attacker cannot
 * READ our CSRF cookie (same-origin policy), so they cannot echo its
 * value back in a header.
 *
 * Only applies when the caller is authenticating via cookie. A Bearer
 * token is not sent automatically by the browser, so it is not subject
 * to CSRF and is exempt.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) return next();

    const usingCookieAuth = Boolean(req.cookies?.[ACCESS_COOKIE]);
    const usingBearer = req.headers.authorization?.startsWith('Bearer ');
    if (!usingCookieAuth || usingBearer) return next();

    // Endpoints that establish a session cannot require a CSRF token
    // that does not exist yet.
    const exemptPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/csrf',
    ];
    if (exemptPaths.some((path) => req.path.endsWith(path))) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
      throw new ForbiddenException(
        'CSRF token missing or invalid. Fetch /api/auth/csrf and send the ' +
          `value in the ${CSRF_HEADER} header.`,
      );
    }

    next();
  }
}
