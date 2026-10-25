import { Injectable } from '@nestjs/common';
import { ApplicationStage, ApplicationStatus, JobStatus, OfferStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { STAGE_LABELS, STAGE_ORDER } from '../../common/constants';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

/**
 * Dashboard metrics.
 *
 * Every number here is a live COUNT/aggregate against MySQL -- there are
 * no cached or hard-coded figures. Counts are issued inside a single
 * $transaction so one render sees one consistent snapshot.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    // Recruiters see their own book of work; HR sees everything.
    const seesAll = user.permissions.includes(PERMISSIONS.JOB_READ_ANY);
    const jobScope = seesAll ? {} : { recruiterId: user.userId };
    const appScope = seesAll ? {} : { OR: [{ recruiterId: user.userId }, { job: { recruiterId: user.userId } }] };

    const [
      totalJobs,
      draftJobs,
      pendingApproval,
      approvedJobs,
      publishedJobs,
      onHoldJobs,
      closedJobs,
      cancelledJobs,
      openPositionsAgg,
      filledAgg,
      totalCandidates,
      newApplications,
      screening,
      shortlisted,
      interviewsScheduled,
      offersReleased,
      offersAccepted,
      hired,
      rejected,
      withdrawn,
    ] = await this.prisma.$transaction([
      this.prisma.jobRequirement.count({ where: jobScope }),
      this.prisma.jobRequirement.count({ where: { ...jobScope, status: JobStatus.DRAFT } }),
      this.prisma.jobRequirement.count({
        where: { ...jobScope, status: JobStatus.PENDING_APPROVAL },
      }),
      this.prisma.jobRequirement.count({ where: { ...jobScope, status: JobStatus.APPROVED } }),
      this.prisma.jobRequirement.count({ where: { ...jobScope, status: JobStatus.PUBLISHED } }),
      this.prisma.jobRequirement.count({ where: { ...jobScope, status: JobStatus.ON_HOLD } }),
      this.prisma.jobRequirement.count({ where: { ...jobScope, status: JobStatus.CLOSED } }),
      this.prisma.jobRequirement.count({ where: { ...jobScope, status: JobStatus.CANCELLED } }),

      // "Open positions" = vacancies on live jobs, not job rows.
      this.prisma.jobRequirement.aggregate({
        where: { ...jobScope, status: { in: [JobStatus.PUBLISHED, JobStatus.APPROVED] } },
        _sum: { vacancies: true },
      }),
      this.prisma.jobRequirement.aggregate({
        where: { ...jobScope, status: { in: [JobStatus.PUBLISHED, JobStatus.APPROVED] } },
        _sum: { vacanciesFilled: true },
      }),

      this.prisma.candidateProfile.count(),

      // "New" = applied in the last 7 days.
      this.prisma.jobApplication.count({
        where: {
          ...appScope,
          appliedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          ...appScope,
          currentStage: {
            in: [ApplicationStage.RESUME_SCREENING, ApplicationStage.HR_SCREENING],
          },
          status: ApplicationStatus.ACTIVE,
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          ...appScope,
          currentStage: ApplicationStage.SHORTLISTED,
          status: ApplicationStatus.ACTIVE,
        },
      }),
      this.prisma.interview.count({
        where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] }, scheduledStart: { gte: new Date() } },
      }),
      this.prisma.offer.count({
        where: {
          status: {
            in: [OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED],
          },
        },
      }),
      this.prisma.offer.count({ where: { status: OfferStatus.ACCEPTED } }),
      this.prisma.jobApplication.count({
        where: { ...appScope, status: ApplicationStatus.HIRED },
      }),
      this.prisma.jobApplication.count({
        where: { ...appScope, status: ApplicationStatus.REJECTED },
      }),
      this.prisma.jobApplication.count({
        where: { ...appScope, status: ApplicationStatus.WITHDRAWN },
      }),
    ]);

    const totalVacancies = openPositionsAgg._sum.vacancies ?? 0;
    const totalFilled = filledAgg._sum.vacanciesFilled ?? 0;

    return {
      jobs: {
        total: totalJobs,
        draft: draftJobs,
        pendingApproval,
        approved: approvedJobs,
        published: publishedJobs,
        onHold: onHoldJobs,
        closed: closedJobs,
        cancelled: cancelledJobs,
        openPositions: Math.max(0, totalVacancies - totalFilled),
      },
      candidates: {
        total: totalCandidates,
        newApplications,
        underScreening: screening,
        shortlisted,
        hired,
        rejected,
        withdrawn,
      },
      interviews: { scheduled: interviewsScheduled },
      offers: { released: offersReleased, accepted: offersAccepted },
      generatedAt: new Date().toISOString(),
    };
  }

  /** Applications per month for the last N months. */
  async applicationsByMonth(months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.jobApplication.findMany({
      where: { appliedAt: { gte: since } },
      select: { appliedAt: true, status: true },
    });

    const buckets = new Map<string, { month: string; applications: number; hired: number }>();
    for (let index = 0; index < months; index += 1) {
      const date = new Date(since);
      date.setMonth(since.getMonth() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { month: key, applications: 0, hired: 0 });
    }

    for (const row of rows) {
      const key = `${row.appliedAt.getFullYear()}-${String(
        row.appliedAt.getMonth() + 1,
      ).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.applications += 1;
      if (row.status === ApplicationStatus.HIRED) bucket.hired += 1;
    }

    return [...buckets.values()];
  }

  /** Candidate counts per recruitment stage (active applications only). */
  async candidatesByStage() {
    const rows = await this.prisma.jobApplication.groupBy({
      by: ['currentStage'],
      where: { status: ApplicationStatus.ACTIVE },
      _count: { _all: true },
    });

    const counts = new Map(rows.map((row) => [row.currentStage, row._count._all]));
    return STAGE_ORDER.map((stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      count: counts.get(stage) ?? 0,
    }));
  }

  async vacanciesByDepartment() {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        jobRequirements: {
          where: { status: { in: [JobStatus.PUBLISHED, JobStatus.APPROVED] } },
          select: { vacancies: true, vacanciesFilled: true },
        },
      },
    });

    return departments
      .map((department) => {
        const vacancies = department.jobRequirements.reduce((sum, job) => sum + job.vacancies, 0);
        const filled = department.jobRequirements.reduce(
          (sum, job) => sum + job.vacanciesFilled,
          0,
        );
        return {
          departmentId: department.id,
          department: department.name,
          openJobs: department.jobRequirements.length,
          vacancies,
          filled,
          remaining: Math.max(0, vacancies - filled),
        };
      })
      .filter((row) => row.openJobs > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }

  /** Which sources actually produce hires, not just volume. */
  async sourcePerformance() {
    const sources = await this.prisma.recruitmentSource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        applications: {
          select: { status: true, currentStage: true },
        },
      },
    });

    return sources
      .map((source) => {
        const total = source.applications.length;
        const hired = source.applications.filter(
          (app) => app.status === ApplicationStatus.HIRED,
        ).length;
        const shortlisted = source.applications.filter((app) =>
          STAGE_ORDER.indexOf(app.currentStage) >= STAGE_ORDER.indexOf(ApplicationStage.SHORTLISTED),
        ).length;

        return {
          sourceId: source.id,
          source: source.name,
          applications: total,
          shortlisted,
          hired,
          conversionRate: total > 0 ? Number(((hired / total) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.applications - a.applications);
  }

  async recruiterPerformance() {
    const recruiters = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: { some: { role: { name: { in: ['RECRUITER', 'HR_ADMIN'] } } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        applicationsAssigned: { select: { status: true, currentStage: true } },
        jobsAsRecruiter: { select: { id: true, status: true } },
      },
    });

    return recruiters
      .map((recruiter) => {
        const applications = recruiter.applicationsAssigned;
        const hired = applications.filter((app) => app.status === ApplicationStatus.HIRED).length;
        const active = applications.filter(
          (app) => app.status === ApplicationStatus.ACTIVE,
        ).length;

        return {
          recruiterId: recruiter.id,
          recruiter: `${recruiter.firstName} ${recruiter.lastName}`,
          openJobs: recruiter.jobsAsRecruiter.filter((job) =>
            ([JobStatus.PUBLISHED, JobStatus.APPROVED] as JobStatus[]).includes(job.status),
          ).length,
          totalApplications: applications.length,
          activeApplications: active,
          hired,
          hireRate:
            applications.length > 0
              ? Number(((hired / applications.length) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => b.hired - a.hired);
  }

  /**
   * Time-to-hire: days from a candidate's application to being hired.
   * Time-to-fill: days from a job being published to its first hire.
   * Both are computed from real timestamps, with the definitions stated
   * in the response so the numbers are not ambiguous.
   */
  async timeMetrics() {
    const hires = await this.prisma.jobApplication.findMany({
      where: { status: ApplicationStatus.HIRED },
      select: {
        appliedAt: true,
        lastUpdatedAt: true,
        job: { select: { id: true, title: true, requirementCode: true, publishedAt: true } },
        statusHistory: {
          where: { toStatus: ApplicationStatus.HIRED },
          orderBy: { changedAt: 'asc' },
          take: 1,
          select: { changedAt: true },
        },
      },
    });

    const timeToHireDays: number[] = [];
    const timeToFillDays: number[] = [];

    for (const hire of hires) {
      const hiredAt = hire.statusHistory[0]?.changedAt ?? hire.lastUpdatedAt;

      timeToHireDays.push(
        Math.max(0, (hiredAt.getTime() - hire.appliedAt.getTime()) / 86_400_000),
      );

      if (hire.job.publishedAt) {
        timeToFillDays.push(
          Math.max(0, (hiredAt.getTime() - hire.job.publishedAt.getTime()) / 86_400_000),
        );
      }
    }

    const average = (values: number[]) =>
      values.length > 0
        ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
        : null;

    const median = (values: number[]) => {
      if (values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return Number(
        (sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]).toFixed(1),
      );
    };

    return {
      timeToHire: {
        definition: 'Days from the candidate applying to the HIRED status being recorded',
        sampleSize: timeToHireDays.length,
        averageDays: average(timeToHireDays),
        medianDays: median(timeToHireDays),
      },
      timeToFill: {
        definition: 'Days from the job being published to a hire being recorded against it',
        sampleSize: timeToFillDays.length,
        averageDays: average(timeToFillDays),
        medianDays: median(timeToFillDays),
      },
    };
  }

  async vacancyFulfilment() {
    const jobs = await this.prisma.jobRequirement.findMany({
      where: { status: { in: [JobStatus.PUBLISHED, JobStatus.APPROVED, JobStatus.CLOSED] } },
      select: {
        id: true,
        requirementCode: true,
        title: true,
        vacancies: true,
        vacanciesFilled: true,
        status: true,
        department: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return jobs.map((job) => ({
      jobId: job.id,
      requirementCode: job.requirementCode,
      title: job.title,
      department: job.department?.name ?? '',
      status: job.status,
      vacancies: job.vacancies,
      filled: job.vacanciesFilled,
      fulfilmentRate:
        job.vacancies > 0
          ? Number(((job.vacanciesFilled / job.vacancies) * 100).toFixed(1))
          : 0,
    }));
  }

  /** Recent activity feed across jobs, applications and interviews. */
  async recentActivity(limit = 15) {
    const [applications, statusChanges, interviews] = await this.prisma.$transaction([
      this.prisma.jobApplication.findMany({
        orderBy: { appliedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          applicationCode: true,
          appliedAt: true,
          candidate: { select: { fullName: true } },
          job: { select: { title: true } },
        },
      }),
      this.prisma.applicationStatusHistory.findMany({
        orderBy: { changedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          toStage: true,
          changedAt: true,
          applicationId: true,
          changedBy: { select: { firstName: true, lastName: true } },
          application: {
            select: { applicationCode: true, candidate: { select: { fullName: true } } },
          },
        },
      }),
      this.prisma.interview.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          interviewCode: true,
          roundName: true,
          scheduledStart: true,
          createdAt: true,
          candidate: { select: { fullName: true } },
        },
      }),
    ]);

    const events = [
      ...applications.map((row) => ({
        type: 'APPLICATION' as const,
        at: row.appliedAt,
        title: `${row.candidate.fullName} applied`,
        detail: row.job.title,
        link: `/applications/${row.id}`,
      })),
      ...statusChanges.map((row) => ({
        type: 'STAGE_CHANGE' as const,
        at: row.changedAt,
        title: `${row.application.candidate.fullName} moved to ${STAGE_LABELS[row.toStage]}`,
        detail: `by ${row.changedBy.firstName} ${row.changedBy.lastName}`,
        link: `/applications/${row.applicationId}`,
      })),
      ...interviews.map((row) => ({
        type: 'INTERVIEW' as const,
        at: row.createdAt,
        title: `${row.roundName} scheduled for ${row.candidate.fullName}`,
        detail: row.scheduledStart.toISOString(),
        link: `/interviews/${row.id}`,
      })),
    ];

    return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  }

  /** Items the signed-in user personally needs to act on. */
  async pendingActions(user: AuthenticatedUser) {
    const [jobApprovals, offerApprovals, pendingFeedback, overdueFollowUps, onboardingTasks] =
      await this.prisma.$transaction([
        this.prisma.jobApproval.count({
          where: { approverId: user.userId, decision: 'PENDING' },
        }),
        this.prisma.offerApproval.count({
          where: { approverId: user.userId, decision: 'PENDING' },
        }),
        this.prisma.interview.count({
          where: {
            panel: { some: { interviewerId: user.userId } },
            scheduledEnd: { lt: new Date() },
            status: { in: ['SCHEDULED', 'RESCHEDULED'] },
            feedback: { none: { interviewerId: user.userId } },
          },
        }),
        this.prisma.jobApplication.count({
          where: {
            recruiterId: user.userId,
            status: ApplicationStatus.ACTIVE,
            followUpDueAt: { lt: new Date() },
          },
        }),
        this.prisma.onboardingTask.count({
          where: {
            ownerUserId: user.userId,
            status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
          },
        }),
      ]);

    return {
      jobApprovals,
      offerApprovals,
      pendingFeedback,
      overdueFollowUps,
      onboardingTasks,
      total:
        jobApprovals + offerApprovals + pendingFeedback + overdueFollowUps + onboardingTasks,
    };
  }
}
