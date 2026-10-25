import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  InterviewStatus,
  JobStatus,
  OfferStatus,
  OnboardingStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { STAGE_LABELS, STAGE_ORDER } from '../../common/constants';
import type { ExportRow } from '../../common/utils/export.util';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  jobId?: string;
  departmentId?: string;
  recruiterId?: string;
  status?: string;
}

/**
 * Recruitment reports.
 *
 * All figures are read from live tables. Metric definitions are returned
 * alongside the data so a number can never be read out of context -- see
 * docs/API.md for the canonical list.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(filters: ReportFilters): Prisma.DateTimeFilter | undefined {
    if (!filters.dateFrom && !filters.dateTo) return undefined;
    return {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }

  // ---- 1. Job requirements -----------------------------------------
  async jobRequirements(filters: ReportFilters): Promise<ExportRow[]> {
    const createdAt = this.dateRange(filters);
    const rows = await this.prisma.jobRequirement.findMany({
      where: {
        ...(createdAt ? { createdAt } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.recruiterId ? { recruiterId: filters.recruiterId } : {}),
        ...(filters.status ? { status: filters.status as JobStatus } : {}),
      },
      include: {
        department: { select: { name: true } },
        recruiter: { select: { firstName: true, lastName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    return rows.map((row) => ({
      'Requirement ID': row.requirementCode,
      Title: row.title,
      Department: row.department?.name ?? '',
      Status: row.status,
      Priority: row.priority,
      Vacancies: row.vacancies,
      Filled: row.vacanciesFilled,
      Applications: row._count.applications,
      Recruiter: row.recruiter ? `${row.recruiter.firstName} ${row.recruiter.lastName}` : '',
      'Requested On': row.requestDate.toISOString().slice(0, 10),
      'Published On': row.publishedAt?.toISOString().slice(0, 10) ?? '',
      'Closed On': row.closedAt?.toISOString().slice(0, 10) ?? '',
    }));
  }

  // ---- 2. Open vacancies -------------------------------------------
  async openVacancies(filters: ReportFilters): Promise<ExportRow[]> {
    const rows = await this.prisma.jobRequirement.findMany({
      where: {
        status: { in: [JobStatus.PUBLISHED, JobStatus.APPROVED, JobStatus.ON_HOLD] },
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      include: {
        department: { select: { name: true } },
        recruiter: { select: { firstName: true, lastName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'asc' }],
    });

    const now = Date.now();
    return rows.map((row) => ({
      'Requirement ID': row.requirementCode,
      Title: row.title,
      Department: row.department?.name ?? '',
      Status: row.status,
      Priority: row.priority,
      Location: row.location,
      Vacancies: row.vacancies,
      Filled: row.vacanciesFilled,
      Remaining: Math.max(0, row.vacancies - row.vacanciesFilled),
      Applications: row._count.applications,
      Recruiter: row.recruiter ? `${row.recruiter.firstName} ${row.recruiter.lastName}` : '',
      'Days Open': row.publishedAt
        ? Math.floor((now - row.publishedAt.getTime()) / 86_400_000)
        : '',
    }));
  }

  // ---- 3. Applications by job --------------------------------------
  async applicationsByJob(filters: ReportFilters): Promise<ExportRow[]> {
    const appliedAt = this.dateRange(filters);
    const jobs = await this.prisma.jobRequirement.findMany({
      where: {
        ...(filters.jobId ? { id: filters.jobId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      select: {
        requirementCode: true,
        title: true,
        vacancies: true,
        department: { select: { name: true } },
        applications: {
          where: appliedAt ? { appliedAt } : {},
          select: { status: true, currentStage: true },
        },
      },
    });

    return jobs
      .filter((job) => job.applications.length > 0)
      .map((job) => {
        const apps = job.applications;
        return {
          'Requirement ID': job.requirementCode,
          Title: job.title,
          Department: job.department?.name ?? '',
          Vacancies: job.vacancies,
          'Total Applications': apps.length,
          Active: apps.filter((a) => a.status === ApplicationStatus.ACTIVE).length,
          Rejected: apps.filter((a) => a.status === ApplicationStatus.REJECTED).length,
          Withdrawn: apps.filter((a) => a.status === ApplicationStatus.WITHDRAWN).length,
          Hired: apps.filter((a) => a.status === ApplicationStatus.HIRED).length,
        };
      });
  }

  // ---- 4. Candidate pipeline ---------------------------------------
  async candidatePipeline(filters: ReportFilters): Promise<ExportRow[]> {
    const rows = await this.prisma.jobApplication.groupBy({
      by: ['currentStage'],
      where: {
        status: ApplicationStatus.ACTIVE,
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
        ...(filters.recruiterId ? { recruiterId: filters.recruiterId } : {}),
      },
      _count: { _all: true },
    });

    const counts = new Map(rows.map((row) => [row.currentStage, row._count._all]));
    const total = [...counts.values()].reduce((a, b) => a + b, 0);

    return STAGE_ORDER.map((stage) => {
      const count = counts.get(stage) ?? 0;
      return {
        Stage: STAGE_LABELS[stage],
        Candidates: count,
        'Share %': total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      };
    });
  }

  // ---- 5. Recruiter performance ------------------------------------
  async recruiterPerformance(filters: ReportFilters): Promise<ExportRow[]> {
    const appliedAt = this.dateRange(filters);
    const recruiters = await this.prisma.user.findMany({
      where: {
        userRoles: { some: { role: { name: { in: ['RECRUITER', 'HR_ADMIN'] } } } },
        ...(filters.recruiterId ? { id: filters.recruiterId } : {}),
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        applicationsAssigned: {
          where: appliedAt ? { appliedAt } : {},
          select: { status: true },
        },
        jobsAsRecruiter: { select: { status: true } },
      },
    });

    return recruiters.map((recruiter) => {
      const apps = recruiter.applicationsAssigned;
      const hired = apps.filter((a) => a.status === ApplicationStatus.HIRED).length;
      return {
        Recruiter: `${recruiter.firstName} ${recruiter.lastName}`,
        Email: recruiter.email,
        'Assigned Jobs': recruiter.jobsAsRecruiter.length,
        'Open Jobs': recruiter.jobsAsRecruiter.filter((j) =>
          ([JobStatus.PUBLISHED, JobStatus.APPROVED] as JobStatus[]).includes(j.status),
        ).length,
        'Total Applications': apps.length,
        Active: apps.filter((a) => a.status === ApplicationStatus.ACTIVE).length,
        Hired: hired,
        'Hire Rate %': apps.length > 0 ? Number(((hired / apps.length) * 100).toFixed(1)) : 0,
      };
    });
  }

  // ---- 6. Source performance ---------------------------------------
  async sourcePerformance(filters: ReportFilters): Promise<ExportRow[]> {
    const appliedAt = this.dateRange(filters);
    const sources = await this.prisma.recruitmentSource.findMany({
      select: {
        name: true,
        category: true,
        applications: {
          where: appliedAt ? { appliedAt } : {},
          select: { status: true, currentStage: true },
        },
      },
    });

    return sources.map((source) => {
      const apps = source.applications;
      const hired = apps.filter((a) => a.status === ApplicationStatus.HIRED).length;
      const shortlisted = apps.filter(
        (a) => STAGE_ORDER.indexOf(a.currentStage) >= STAGE_ORDER.indexOf('SHORTLISTED'),
      ).length;
      return {
        Source: source.name,
        Category: source.category ?? '',
        Applications: apps.length,
        Shortlisted: shortlisted,
        Hired: hired,
        'Conversion %': apps.length > 0 ? Number(((hired / apps.length) * 100).toFixed(1)) : 0,
      };
    });
  }

  // ---- 7. Interview outcomes ---------------------------------------
  async interviewOutcomes(filters: ReportFilters): Promise<ExportRow[]> {
    const scheduledStart = this.dateRange(filters);
    const interviews = await this.prisma.interview.findMany({
      where: {
        ...(scheduledStart ? { scheduledStart } : {}),
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
      },
      include: {
        candidate: { select: { candidateCode: true, fullName: true } },
        job: { select: { requirementCode: true, title: true } },
        feedback: { select: { overallRating: true, recommendation: true } },
      },
      orderBy: { scheduledStart: 'desc' },
      take: 10000,
    });

    return interviews.map((interview) => {
      const ratings = interview.feedback.map((f) => f.overallRating);
      return {
        'Interview ID': interview.interviewCode,
        Candidate: interview.candidate.fullName,
        'Candidate ID': interview.candidate.candidateCode,
        'Job Code': interview.job.requirementCode,
        'Job Title': interview.job.title,
        Round: interview.roundName,
        Type: interview.interviewType,
        'Scheduled On': interview.scheduledStart.toISOString().slice(0, 16).replace('T', ' '),
        Status: interview.status,
        'Feedback Count': interview.feedback.length,
        'Average Rating':
          ratings.length > 0
            ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
            : '',
        Recommendations: interview.feedback.map((f) => f.recommendation).join('; '),
      };
    });
  }

  // ---- 8. Offer acceptance / decline --------------------------------
  async offerOutcomes(filters: ReportFilters): Promise<ExportRow[]> {
    const createdAt = this.dateRange(filters);
    const offers = await this.prisma.offer.findMany({
      where: {
        ...(createdAt ? { createdAt } : {}),
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
      },
      include: {
        candidate: { select: { candidateCode: true, fullName: true } },
        job: { select: { requirementCode: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    return offers.map((offer) => ({
      'Offer ID': offer.offerCode,
      Candidate: offer.candidate.fullName,
      'Candidate ID': offer.candidate.candidateCode,
      'Job Code': offer.job.requirementCode,
      'Job Title': offer.job.title,
      Designation: offer.proposedDesignation,
      Status: offer.status,
      'Issued On': offer.issuedAt?.toISOString().slice(0, 10) ?? '',
      'Responded On': offer.respondedAt?.toISOString().slice(0, 10) ?? '',
      'Joining Date': offer.joiningDate.toISOString().slice(0, 10),
      'Decline Reason': offer.declineReason ?? '',
      'Days to Respond':
        offer.issuedAt && offer.respondedAt
          ? Math.round((offer.respondedAt.getTime() - offer.issuedAt.getTime()) / 86_400_000)
          : '',
    }));
  }

  /** Offer acceptance rate, with the denominator stated explicitly. */
  async offerAcceptanceSummary(filters: ReportFilters) {
    const createdAt = this.dateRange(filters);
    const where = createdAt ? { createdAt } : {};

    const [sent, accepted, declined, expired, withdrawn] = await this.prisma.$transaction([
      this.prisma.offer.count({
        where: {
          ...where,
          status: {
            in: [
              OfferStatus.SENT,
              OfferStatus.ACCEPTED,
              OfferStatus.DECLINED,
              OfferStatus.EXPIRED,
            ],
          },
        },
      }),
      this.prisma.offer.count({ where: { ...where, status: OfferStatus.ACCEPTED } }),
      this.prisma.offer.count({ where: { ...where, status: OfferStatus.DECLINED } }),
      this.prisma.offer.count({ where: { ...where, status: OfferStatus.EXPIRED } }),
      this.prisma.offer.count({ where: { ...where, status: OfferStatus.WITHDRAWN } }),
    ]);

    return {
      definition:
        'Acceptance rate = accepted / (offers that reached the candidate: ' +
        'sent + accepted + declined + expired). Withdrawn offers are excluded.',
      offersSent: sent,
      accepted,
      declined,
      expired,
      withdrawn,
      acceptanceRate: sent > 0 ? Number(((accepted / sent) * 100).toFixed(1)) : null,
    };
  }

  // ---- 9. Rejection reasons -----------------------------------------
  async rejectionReasons(filters: ReportFilters): Promise<ExportRow[]> {
    const lastUpdatedAt = this.dateRange(filters);
    const rows = await this.prisma.jobApplication.findMany({
      where: {
        status: ApplicationStatus.REJECTED,
        ...(lastUpdatedAt ? { lastUpdatedAt } : {}),
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
      },
      select: { rejectionReason: true, currentStage: true },
      take: 10000,
    });

    const grouped = new Map<string, { count: number; stages: Map<string, number> }>();
    for (const row of rows) {
      const reason = (row.rejectionReason ?? 'Not specified').trim() || 'Not specified';
      const entry = grouped.get(reason) ?? { count: 0, stages: new Map() };
      entry.count += 1;
      entry.stages.set(row.currentStage, (entry.stages.get(row.currentStage) ?? 0) + 1);
      grouped.set(reason, entry);
    }

    const total = rows.length;
    return [...grouped.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([reason, entry]) => ({
        Reason: reason,
        Count: entry.count,
        'Share %': total > 0 ? Number(((entry.count / total) * 100).toFixed(1)) : 0,
        'Most Common Stage':
          [...entry.stages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
      }));
  }

  // ---- 10/11. Time to hire / fill -----------------------------------
  async timeToHire(filters: ReportFilters): Promise<ExportRow[]> {
    const hires = await this.prisma.jobApplication.findMany({
      where: {
        status: ApplicationStatus.HIRED,
        ...(filters.jobId ? { jobId: filters.jobId } : {}),
      },
      select: {
        applicationCode: true,
        appliedAt: true,
        lastUpdatedAt: true,
        candidate: { select: { fullName: true } },
        job: { select: { requirementCode: true, title: true, publishedAt: true } },
        statusHistory: {
          where: { toStatus: ApplicationStatus.HIRED },
          orderBy: { changedAt: 'asc' },
          take: 1,
          select: { changedAt: true },
        },
      },
      take: 10000,
    });

    return hires.map((hire) => {
      const hiredAt = hire.statusHistory[0]?.changedAt ?? hire.lastUpdatedAt;
      return {
        'Application ID': hire.applicationCode,
        Candidate: hire.candidate.fullName,
        'Job Code': hire.job.requirementCode,
        'Job Title': hire.job.title,
        'Applied On': hire.appliedAt.toISOString().slice(0, 10),
        'Hired On': hiredAt.toISOString().slice(0, 10),
        'Time to Hire (days)': Math.round(
          (hiredAt.getTime() - hire.appliedAt.getTime()) / 86_400_000,
        ),
        'Time to Fill (days)': hire.job.publishedAt
          ? Math.round((hiredAt.getTime() - hire.job.publishedAt.getTime()) / 86_400_000)
          : '',
      };
    });
  }

  // ---- 12. Vacancy fulfilment ---------------------------------------
  async vacancyFulfilment(filters: ReportFilters): Promise<ExportRow[]> {
    const rows = await this.prisma.jobRequirement.findMany({
      where: {
        status: { in: [JobStatus.PUBLISHED, JobStatus.APPROVED, JobStatus.CLOSED] },
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      include: { department: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      'Requirement ID': row.requirementCode,
      Title: row.title,
      Department: row.department?.name ?? '',
      Status: row.status,
      Vacancies: row.vacancies,
      Filled: row.vacanciesFilled,
      Remaining: Math.max(0, row.vacancies - row.vacanciesFilled),
      'Fulfilment %':
        row.vacancies > 0
          ? Number(((row.vacanciesFilled / row.vacancies) * 100).toFixed(1))
          : 0,
    }));
  }

  // ---- 13. Onboarding completion -------------------------------------
  async onboardingCompletion(filters: ReportFilters): Promise<ExportRow[]> {
    const joiningDate = this.dateRange(filters);
    const records = await this.prisma.onboardingRecord.findMany({
      where: {
        ...(joiningDate ? { joiningDate } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      include: {
        candidate: { select: { fullName: true, candidateCode: true } },
        department: { select: { name: true } },
        tasks: { select: { status: true, isMandatory: true } },
      },
      orderBy: { joiningDate: 'asc' },
    });

    return records.map((record) => {
      const done = record.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const mandatoryOpen = record.tasks.filter(
        (t) => t.isMandatory && t.status !== TaskStatus.COMPLETED,
      ).length;
      return {
        'Onboarding ID': record.onboardingCode,
        Candidate: record.candidate.fullName,
        'Candidate ID': record.candidate.candidateCode,
        Department: record.department?.name ?? '',
        Designation: record.designation,
        Status: record.status,
        'Joining Date': record.joiningDate.toISOString().slice(0, 10),
        'Actual Join Date': record.actualJoinDate?.toISOString().slice(0, 10) ?? '',
        'Tasks Total': record.tasks.length,
        'Tasks Completed': done,
        'Mandatory Outstanding': mandatoryOpen,
        'Completion %':
          record.tasks.length > 0 ? Number(((done / record.tasks.length) * 100).toFixed(1)) : 0,
        'Did Not Join Reason': record.didNotJoinReason ?? '',
      };
    });
  }

  /** Report registry -- keeps the controller and docs in sync. */
  readonly registry: Record<
    string,
    { name: string; definition: string; run: (f: ReportFilters) => Promise<ExportRow[]> }
  > = {
    'job-requirements': {
      name: 'Job Requirements',
      definition: 'All job requirements created in the period, with status and application counts.',
      run: (f) => this.jobRequirements(f),
    },
    'open-vacancies': {
      name: 'Open Vacancies',
      definition:
        'Requirements in PUBLISHED, APPROVED or ON_HOLD, with remaining vacancies and days open.',
      run: (f) => this.openVacancies(f),
    },
    'applications-by-job': {
      name: 'Applications by Job',
      definition: 'Application counts per requirement, broken down by outcome.',
      run: (f) => this.applicationsByJob(f),
    },
    'candidate-pipeline': {
      name: 'Candidate Pipeline',
      definition: 'Active applications per recruitment stage.',
      run: (f) => this.candidatePipeline(f),
    },
    'recruiter-performance': {
      name: 'Recruiter Performance',
      definition: 'Per recruiter: assigned jobs, applications handled and hire rate.',
      run: (f) => this.recruiterPerformance(f),
    },
    'source-performance': {
      name: 'Recruitment Source Performance',
      definition: 'Applications, shortlists and hires per source, with conversion rate.',
      run: (f) => this.sourcePerformance(f),
    },
    'interview-outcomes': {
      name: 'Interview Outcomes',
      definition: 'Interviews with status, feedback counts, average rating and recommendations.',
      run: (f) => this.interviewOutcomes(f),
    },
    'offer-outcomes': {
      name: 'Offer Acceptance and Decline',
      definition:
        'Offers with status, response time and decline reasons. ' +
        'Acceptance rate excludes withdrawn offers.',
      run: (f) => this.offerOutcomes(f),
    },
    'rejection-reasons': {
      name: 'Rejection Reasons',
      definition: 'Rejected applications grouped by recorded reason.',
      run: (f) => this.rejectionReasons(f),
    },
    'time-to-hire': {
      name: 'Time to Hire and Time to Fill',
      definition:
        'Time to hire = applied -> hired. Time to fill = job published -> hired.',
      run: (f) => this.timeToHire(f),
    },
    'vacancy-fulfilment': {
      name: 'Vacancy Fulfilment',
      definition: 'Vacancies filled against vacancies requested, per requirement.',
      run: (f) => this.vacancyFulfilment(f),
    },
    'onboarding-completion': {
      name: 'Onboarding Completion',
      definition: 'Onboarding records with checklist completion and join outcome.',
      run: (f) => this.onboardingCompletion(f),
    },
  };
}
