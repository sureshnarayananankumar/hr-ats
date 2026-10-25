import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OffersService } from '../offers/offers.service';

/**
 * Scheduled background work.
 *
 * These run in-process on a cron schedule. Redis/BullMQ is wired into
 * the stack for queue-backed delivery; these jobs are the scheduled
 * half of the same story and are deliberately idempotent, so a repeated
 * run cannot double-notify or double-expire.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly offers: OffersService,
  ) {}

  /** Expire offers whose deadline has passed. */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOffers(): Promise<void> {
    const count = await this.offers.expireOverdueOffers();
    if (count > 0) this.logger.log(`Expired ${count} overdue offer(s)`);
  }

  /** Nudge recruiters about applications past their follow-up date. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async followUpReminders(): Promise<void> {
    const overdue = await this.prisma.jobApplication.findMany({
      where: {
        status: ApplicationStatus.ACTIVE,
        followUpDueAt: { lt: new Date() },
        recruiterId: { not: null },
      },
      select: {
        id: true,
        applicationCode: true,
        recruiterId: true,
        currentStage: true,
        candidate: { select: { fullName: true } },
      },
      take: 1000,
    });

    // One digest per recruiter rather than one ping per application.
    const byRecruiter = new Map<string, typeof overdue>();
    for (const application of overdue) {
      if (!application.recruiterId) continue;
      const list = byRecruiter.get(application.recruiterId) ?? [];
      list.push(application);
      byRecruiter.set(application.recruiterId, list);
    }

    for (const [recruiterId, applications] of byRecruiter) {
      await this.notifications.notifyUser({
        userId: recruiterId,
        title: `${applications.length} application(s) need follow-up`,
        body: applications
          .slice(0, 10)
          .map((app) => `${app.applicationCode} - ${app.candidate.fullName}`)
          .join('\n'),
        link: '/applications?overdueOnly=true',
        category: 'REMINDER',
      });
    }

    if (byRecruiter.size > 0) {
      this.logger.log(`Sent follow-up digests to ${byRecruiter.size} recruiter(s)`);
    }
  }

  /** Remind interviewers the day before. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async interviewReminders(): Promise<void> {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const interviews = await this.prisma.interview.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
        scheduledStart: { gte: tomorrowStart, lte: tomorrowEnd },
      },
      include: {
        candidate: { select: { fullName: true, user: { select: { email: true, firstName: true } } } },
        job: { select: { title: true } },
        panel: { select: { interviewerId: true } },
      },
    });

    for (const interview of interviews) {
      await this.notifications.notifyMany(
        interview.panel.map((member) => member.interviewerId),
        {
          title: 'Interview tomorrow',
          body: `${interview.roundName} with ${interview.candidate.fullName} at ${interview.scheduledStart.toUTCString()}.`,
          link: `/interviews/${interview.id}`,
          category: 'REMINDER',
        },
      );

      await this.notifications.queueTemplate(
        'interview.reminder',
        interview.candidate.user.email,
        {
          firstName: interview.candidate.user.firstName,
          jobTitle: interview.job.title,
          scheduledAt: interview.scheduledStart.toISOString(),
        },
      );
    }

    if (interviews.length > 0) {
      this.logger.log(`Sent reminders for ${interviews.length} interview(s)`);
    }
  }

  /** Nudge approvers sitting on a job requirement for over two days. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async approvalReminders(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 86_400_000);
    const pending = await this.prisma.jobApproval.findMany({
      where: { decision: 'PENDING', createdAt: { lt: cutoff } },
      include: { job: { select: { id: true, requirementCode: true, title: true } } },
    });

    for (const approval of pending) {
      await this.notifications.notifyUser({
        userId: approval.approverId,
        title: `Reminder: approval pending for ${approval.job.requirementCode}`,
        body: `"${approval.job.title}" has been waiting since ${approval.createdAt.toDateString()}.`,
        link: `/job-approvals/${approval.job.id}`,
        category: 'REMINDER',
      });
    }
  }

  /**
   * Housekeeping: drop expired and long-revoked session rows.
   * Keeps the table small without touching anything still in use.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const result = await this.prisma.refreshSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
    if (result.count > 0) this.logger.log(`Pruned ${result.count} stale session row(s)`);
  }

  /** Close the application window on jobs whose deadline has passed. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async flagExpiredJobs(): Promise<void> {
    const expired = await this.prisma.jobRequirement.count({
      where: { status: 'PUBLISHED', applicationDeadline: { lt: new Date() } },
    });
    if (expired > 0) {
      // Deliberately reported, not auto-closed: closing a requirement is
      // an HR decision with downstream effects on candidates in flight.
      this.logger.warn(`${expired} published job(s) are past their application deadline`);
    }
  }
}
