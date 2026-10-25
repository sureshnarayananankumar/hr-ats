import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailStatus, NotificationChannel } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationQueryDto, buildPage } from '../../common/dto/pagination.dto';

/**
 * In-app notifications and transactional email.
 *
 * Email is written to `email_logs` first and dispatched afterwards, so a
 * delivery failure is always visible and retryable rather than silent.
 * SMTP credentials come from the environment -- never from source.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter?: Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getTransport(): Transporter {
    if (!this.transporter) {
      const mail = this.config.get<{
        host: string;
        port: number;
        secure: boolean;
        user?: string;
        password?: string;
      }>('mail')!;

      this.transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        // MailHog in development accepts unauthenticated mail.
        auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
      });
    }
    return this.transporter;
  }

  // ===================================================================
  //  In-app notifications
  // ===================================================================

  async notifyUser(input: {
    userId: string;
    title: string;
    body: string;
    link?: string;
    category?: string;
    channel?: NotificationChannel;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title.slice(0, 300),
        body: input.body,
        link: input.link?.slice(0, 400),
        category: input.category?.slice(0, 60),
        channel: input.channel ?? NotificationChannel.IN_APP,
      },
    });
  }

  /** Fan-out helper used when several approvers must be alerted. */
  async notifyMany(userIds: string[], payload: Omit<Parameters<typeof this.notifyUser>[0], 'userId'>) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return { count: 0 };

    return this.prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        title: payload.title.slice(0, 300),
        body: payload.body,
        link: payload.link?.slice(0, 400),
        category: payload.category?.slice(0, 60),
        channel: payload.channel ?? NotificationChannel.IN_APP,
      })),
    });
  }

  async listForUser(userId: string, query: PaginationQueryDto, unreadOnly = false) {
    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { ...buildPage(data, total, query), unreadCount };
  }

  /**
   * Marks one notification read.
   * Scoped by userId so a caller can never mark someone else's
   * notification -- an IDOR guard at the query level.
   */
  async markRead(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      // Either it does not exist, is already read, or belongs to someone
      // else. All three return the same response, revealing nothing.
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async unreadCount(userId: string) {
    return { unread: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  // ===================================================================
  //  Email
  // ===================================================================

  /**
   * Renders a stored template and sends it.
   *
   * A missing template is logged rather than thrown: a notification
   * should never break the business action that triggered it.
   */
  async queueTemplate(
    templateKey: string,
    toEmail: string,
    variables: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { key: templateKey },
      });

      if (!template || !template.isActive) {
        this.logger.warn(`Notification template "${templateKey}" is missing or inactive`);
        return;
      }

      const subject = this.render(template.subject, variables);
      const html = this.render(template.bodyHtml, variables);
      const text = template.bodyText ? this.render(template.bodyText, variables) : undefined;

      const log = await this.prisma.emailLog.create({
        data: {
          templateId: template.id,
          toEmail: toEmail.slice(0, 255),
          subject: subject.slice(0, 300),
          status: EmailStatus.QUEUED,
        },
      });

      await this.dispatch(log.id, toEmail, subject, html, text);
    } catch (error) {
      this.logger.error(
        `Failed to queue template ${templateKey}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async dispatch(
    logId: string,
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    try {
      const info = await this.getTransport().sendMail({
        from: this.config.get<string>('mail.from'),
        to,
        subject,
        html,
        text,
      });

      await this.prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerId: String(info.messageId ?? '').slice(0, 255),
          attempts: { increment: 1 },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email delivery failed for log ${logId}: ${message}`);
      await this.prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: EmailStatus.FAILED,
          // The provider error, not the message body -- no PII in logs.
          errorMessage: message.slice(0, 1000),
          attempts: { increment: 1 },
        },
      });
    }
  }

  /**
   * Replaces {{placeholders}}.
   *
   * Values are HTML-escaped, so a candidate name containing markup can
   * never inject script into an email we send to a recruiter.
   */
  private render(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null) return match;
      return this.escapeHtml(String(value));
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===================================================================
  //  Template administration
  // ===================================================================

  async listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  async updateTemplate(
    id: string,
    data: { subject?: string; bodyHtml?: string; bodyText?: string; isActive?: boolean },
  ) {
    return this.prisma.notificationTemplate.update({ where: { id }, data });
  }

  async listEmailLogs(query: PaginationQueryDto, status?: EmailStatus) {
    const where = status ? { status } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { template: { select: { key: true, name: true } } },
      }),
      this.prisma.emailLog.count({ where }),
    ]);
    return buildPage(data, total, query);
  }
}
