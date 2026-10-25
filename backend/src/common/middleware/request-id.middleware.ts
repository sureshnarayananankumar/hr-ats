import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Correlates API logs with Kong's gateway logs.
 *
 * Kong sets X-Request-Id on every proxied request. We adopt it when
 * present so one request can be traced end to end, and mint our own
 * when the API is called directly (development, health checks).
 *
 * The incoming value is sanitised before use: it ends up in log lines
 * and a response header, so unconstrained client input here would allow
 * log forging and header injection.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;

    const requestId =
      candidate && /^[A-Za-z0-9._-]{1,64}$/.test(candidate) ? candidate : randomUUID();

    (req as Request & { id: string }).id = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
