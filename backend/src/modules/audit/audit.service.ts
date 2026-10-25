import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationQueryDto, buildPage, safeSort } from '../../common/dto/pagination.dto';

export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
}

/** Never written to the audit trail, whatever the caller passes. */
const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'tokenhash',
  'secret',
  'mfasecret',
  'recoverycodes',
  'cookie',
  'authorization',
  'ssn',
  'creditcard',
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an audit record.
   *
   * Audit logging must never break the business operation it is
   * recording, so failures here are logged and swallowed rather than
   * propagated to the caller.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorUserId: entry.actorUserId ?? null,
          actorEmail: entry.actorEmail ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata ? JSON.stringify(this.redact(entry.metadata)) : null,
          ipAddress: entry.ipAddress?.slice(0, 45) ?? null,
          userAgent: entry.userAgent?.slice(0, 400) ?? null,
          requestId: entry.requestId?.slice(0, 64) ?? null,
          severity: entry.severity ?? 'INFO',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for action ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Strips anything that looks like a credential or token before the
   * metadata is persisted. Applied recursively.
   */
  private redact(input: unknown, depth = 0): unknown {
    if (depth > 5 || input === null || input === undefined) return input;

    if (Array.isArray(input)) {
      return input.slice(0, 50).map((item) => this.redact(item, depth + 1));
    }

    if (typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (REDACTED_KEYS.includes(key.toLowerCase().replace(/[_-]/g, ''))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.redact(value, depth + 1);
        }
      }
      return result;
    }

    if (typeof input === 'string' && input.length > 1000) {
      return `${input.slice(0, 1000)}...[truncated]`;
    }

    return input;
  }

  async findAll(
    query: PaginationQueryDto & {
      action?: string;
      actorUserId?: string;
      entityType?: string;
      severity?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) where.action = query.action;
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.severity) where.severity = query.severity;
    if (query.search) {
      where.OR = [
        { action: { contains: query.search } },
        { actorEmail: { contains: query.search } },
        { entityId: { contains: query.search } },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const sortBy = safeSort(query.sortBy, ['createdAt', 'action', 'severity'], 'createdAt');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { [sortBy]: query.sortDir },
        skip: query.skip,
        take: query.take,
        include: {
          actor: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // BigInt ids are not JSON-serialisable; expose them as strings.
    const data = rows.map((row) => ({ ...row, id: row.id.toString() }));
    return buildPage(data, total, query);
  }

  /** Security dashboard: counts of the events that matter most. */
  async securitySummary(since: Date) {
    const [failedLogins, lockouts, unauthorized, documentDenials, tokenReuse] =
      await this.prisma.$transaction([
        this.prisma.auditLog.count({
          where: { action: 'LOGIN_FAILED', createdAt: { gte: since } },
        }),
        this.prisma.auditLog.count({
          where: { action: 'LOGIN_LOCKED', createdAt: { gte: since } },
        }),
        this.prisma.auditLog.count({
          where: { action: 'UNAUTHORIZED_ACCESS', createdAt: { gte: since } },
        }),
        this.prisma.auditLog.count({
          where: { action: 'DOCUMENT_ACCESS_DENIED', createdAt: { gte: since } },
        }),
        this.prisma.auditLog.count({
          where: { action: 'TOKEN_REUSE_DETECTED', createdAt: { gte: since } },
        }),
      ]);

    return { since, failedLogins, lockouts, unauthorized, documentDenials, tokenReuse };
  }
}
