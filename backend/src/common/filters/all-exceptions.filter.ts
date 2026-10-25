import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * One consistent error shape for the whole API, and the last line of
 * defence against leaking internals.
 *
 * Unexpected errors are logged in full server-side but returned to the
 * client as a generic message plus a correlation id -- stack traces,
 * SQL fragments and Prisma internals never reach the browser.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ??
      (request as Request & { id?: string }).id ??
      randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const payload = body as Record<string, unknown>;
        message = (payload.message as string | string[]) ?? exception.message;
        error = (payload.error as string) ?? exception.name;
        if (payload.details) details = payload.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message, error } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid request data';
      error = 'Bad Request';
    }

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status === 401 || status === 403) {
      // Security-relevant but expected; log without the stack.
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} -> ${status} (${
          Array.isArray(message) ? message.join('; ') : message
        })`,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details ? { details } : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | string) ?? 'field';
        const fields = Array.isArray(target) ? target.join(', ') : String(target);
        // The duplicate-application guard surfaces here.
        if (fields.includes('activeJobKey')) {
          return {
            status: HttpStatus.CONFLICT,
            message: 'You already have an active application for this job',
            error: 'Conflict',
          };
        }
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${fields} already exists`,
          error: 'Conflict',
        };
      }
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist',
          error: 'Bad Request',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          error: 'Internal Server Error',
        };
    }
  }
}
