import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  JobStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AUDIT_ACTIONS,
  STAGE_FOLLOWUP_DAYS,
  STAGE_LABELS,
  STAGE_ORDER,
  TERMINAL_APPLICATION_STATUSES,
  isValidStageTransition,
} from '../../common/constants';
import { generateApplicationCode } from '../../common/utils/codes.util';
import { buildPage, safeSort } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import type {
  ApplicationQueryDto,
  BulkTransitionDto,
  CreateApplicationDto,
  TransitionDto,
} from './applications.dto';

const SORTABLE = ['appliedAt', 'lastUpdatedAt', 'currentStage', 'status', 'stageEnteredAt'] as const;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===================================================================
  //  Apply
  // ===================================================================

  /**
   * Creates an application.
   *
   * The duplicate guard is enforced by a UNIQUE index on
   * (candidateId, activeJobKey), not by a read-then-write check, so two
   * concurrent submissions cannot both succeed.
   */
  async apply(
    candidateId: string,
    dto: CreateApplicationDto,
    user: AuthenticatedUser,
    ip: string,
  ) {
    const job = await this.prisma.jobRequirement.findUnique({
      where: { id: dto.jobId },
      select: {
        id: true,
        title: true,
        requirementCode: true,
        status: true,
        applicationDeadline: true,
        recruiterId: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');

    // Only live, published roles accept applications.
    if (job.status !== JobStatus.PUBLISHED) {
      throw new BadRequestException('This job is not currently accepting applications');
    }
    if (job.applicationDeadline && job.applicationDeadline < new Date()) {
      throw new BadRequestException('The application deadline for this job has passed');
    }

    // A resume must belong to the applying candidate.
    if (dto.resumeDocumentId) {
      const document = await this.prisma.candidateDocument.findFirst({
        where: { id: dto.resumeDocumentId, candidateId, deletedAt: null },
        select: { id: true },
      });
      if (!document) {
        throw new BadRequestException('The selected resume could not be found');
      }
    }

    try {
      const application = await this.prisma.$transaction(async (tx) => {
        const code = await generateApplicationCode(tx);
        const created = await tx.jobApplication.create({
          data: {
            applicationCode: code,
            candidateId,
            jobId: dto.jobId,
            // Set while ACTIVE; cleared on a terminal status. This is
            // what makes the unique index a "one live application" rule.
            activeJobKey: dto.jobId,
            resumeDocumentId: dto.resumeDocumentId,
            coverLetter: dto.coverLetter,
            sourceId: dto.sourceId,
            recruiterId: job.recruiterId,
            currentStage: ApplicationStage.APPLIED,
            status: ApplicationStatus.ACTIVE,
            stageEnteredAt: new Date(),
            followUpDueAt: this.followUpDate(ApplicationStage.APPLIED),
          },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId: created.id,
            fromStage: null,
            toStage: ApplicationStage.APPLIED,
            fromStatus: null,
            toStatus: ApplicationStatus.ACTIVE,
            changedById: user.userId,
            reason: 'Application submitted',
          },
        });

        await tx.candidateActivity.create({
          data: {
            candidateId,
            activity: 'APPLIED',
            detail: `Applied for ${job.title} (${job.requirementCode})`,
            actorUserId: user.userId,
          },
        });

        return created;
      });

      await this.audit.log({
        action: AUDIT_ACTIONS.APPLICATION_CREATED,
        actorUserId: user.userId,
        actorEmail: user.email,
        entityType: 'JobApplication',
        entityId: application.id,
        metadata: { jobId: dto.jobId, applicationCode: application.applicationCode },
        ipAddress: ip,
      });

      const candidate = await this.prisma.candidateProfile.findUniqueOrThrow({
        where: { id: candidateId },
        include: { user: { select: { email: true, firstName: true } } },
      });

      await this.notifications.queueTemplate(
        'application.received',
        candidate.user.email,
        {
          firstName: candidate.user.firstName,
          jobTitle: job.title,
          applicationCode: application.applicationCode,
        },
      );

      if (job.recruiterId) {
        await this.notifications.notifyUser({
          userId: job.recruiterId,
          title: `New application for ${job.requirementCode}`,
          body: `${candidate.fullName} applied for "${job.title}".`,
          link: `/applications/${application.id}`,
          category: 'APPLICATION',
        });
      }

      return application;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You already have an active application for this job');
      }
      throw error;
    }
  }

  // ===================================================================
  //  Read
  // ===================================================================

  async findAll(query: ApplicationQueryDto, user: AuthenticatedUser) {
    const where = await this.scopedWhere(query, user);
    const sortBy = safeSort(query.sortBy, SORTABLE, 'appliedAt');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobApplication.findMany({
        where,
        orderBy: { [sortBy]: query.sortDir },
        skip: query.skip,
        take: query.take,
        include: {
          candidate: {
            select: {
              id: true,
              candidateCode: true,
              fullName: true,
              totalExperience: true,
              currentDesignation: true,
              location: true,
              skills: { include: { skill: { select: { name: true } } }, take: 8 },
            },
          },
          job: {
            select: { id: true, title: true, requirementCode: true, status: true },
          },
          recruiter: { select: { id: true, firstName: true, lastName: true } },
          source: { select: { id: true, name: true } },
          interviews: {
            where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
            orderBy: { scheduledStart: 'asc' },
            take: 1,
            select: { id: true, scheduledStart: true, roundName: true },
          },
        },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    const now = Date.now();
    const data = rows.map((row) => ({
      ...row,
      stageLabel: STAGE_LABELS[row.currentStage],
      nextInterview: row.interviews[0] ?? null,
      // Drives the overdue indicator on the pipeline board.
      isOverdue: Boolean(
        row.followUpDueAt &&
          row.followUpDueAt.getTime() < now &&
          row.status === ApplicationStatus.ACTIVE,
      ),
      interviews: undefined,
    }));

    return buildPage(data, total, query);
  }

  /**
   * Applies role-based visibility.
   * A candidate is restricted to their own applications at the query
   * level, so changing an id in the URL cannot widen the result set.
   */
  private async scopedWhere(
    query: ApplicationQueryDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.JobApplicationWhereInput> {
    const where: Prisma.JobApplicationWhereInput = {};

    if (query.jobId) where.jobId = query.jobId;
    if (query.candidateId) where.candidateId = query.candidateId;
    if (query.stage?.length) where.currentStage = { in: query.stage };
    if (query.status?.length) where.status = { in: query.status };
    if (query.recruiterId) where.recruiterId = query.recruiterId;
    if (query.sourceId) where.sourceId = query.sourceId;

    if (query.appliedFrom || query.appliedTo) {
      where.appliedAt = {
        ...(query.appliedFrom ? { gte: new Date(query.appliedFrom) } : {}),
        ...(query.appliedTo ? { lte: new Date(query.appliedTo) } : {}),
      };
    }

    if (query.overdueOnly) {
      where.followUpDueAt = { lt: new Date() };
      where.status = { in: [ApplicationStatus.ACTIVE] };
    }

    if (query.search) {
      where.OR = [
        { applicationCode: { contains: query.search } },
        { candidate: { fullName: { contains: query.search } } },
        { candidate: { candidateCode: { contains: query.search } } },
        { job: { title: { contains: query.search } } },
      ];
    }

    // --- Visibility scoping -------------------------------------------
    if (user.permissions.includes(PERMISSIONS.APPLICATION_READ_ANY)) {
      return where;
    }

    if (user.permissions.includes(PERMISSIONS.APPLICATION_READ_OWN) && user.candidateId) {
      // Candidates: hard-pinned to their own candidate id.
      where.candidateId = user.candidateId;
      return where;
    }

    if (user.permissions.includes(PERMISSIONS.APPLICATION_READ_ASSIGNED)) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { recruiterId: user.userId },
            { job: { recruiterId: user.userId } },
            { job: { hiringManagerId: user.userId } },
          ],
        },
      ];
      return where;
    }

    throw new ForbiddenException('You do not have access to applications');
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            user: { select: { email: true, phone: true } },
            skills: { include: { skill: true } },
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            requirementCode: true,
            department: { select: { name: true } },
            status: true,
          },
        },
        recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        source: true,
        resumeDocument: {
          select: { id: true, originalName: true, version: true, uploadedAt: true },
        },
        interviews: {
          orderBy: { scheduledStart: 'desc' },
          include: {
            panel: {
              include: {
                interviewer: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        offers: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(application, user);

    const isCandidateView = this.isCandidateSelfView(application, user);

    return {
      ...application,
      stageLabel: STAGE_LABELS[application.currentStage],
      // Internal screening remarks and rejection detail are never shown
      // to the candidate themselves.
      screeningRemarks: isCandidateView ? undefined : application.screeningRemarks,
      rejectionReason: isCandidateView ? undefined : application.rejectionReason,
    };
  }

  private isCandidateSelfView(
    application: { candidateId: string },
    user: AuthenticatedUser,
  ): boolean {
    return (
      !user.permissions.includes(PERMISSIONS.APPLICATION_READ_ANY) &&
      !user.permissions.includes(PERMISSIONS.APPLICATION_READ_ASSIGNED) &&
      user.candidateId === application.candidateId
    );
  }

  /** Object-level access check -- the IDOR guard for a single record. */
  private async assertCanView(
    application: { candidateId: string; recruiterId: string | null; jobId: string },
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.permissions.includes(PERMISSIONS.APPLICATION_READ_ANY)) return;

    if (user.candidateId && application.candidateId === user.candidateId) return;

    if (user.permissions.includes(PERMISSIONS.APPLICATION_READ_ASSIGNED)) {
      if (application.recruiterId === user.userId) return;

      const job = await this.prisma.jobRequirement.findUnique({
        where: { id: application.jobId },
        select: { recruiterId: true, hiringManagerId: true },
      });
      if (job?.recruiterId === user.userId || job?.hiringManagerId === user.userId) return;
    }

    await this.audit.log({
      action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobApplication',
      severity: 'WARN',
      metadata: { attemptedCandidateId: application.candidateId },
    });

    throw new ForbiddenException('You do not have access to this application');
  }

  async history(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);
    const rows = await this.prisma.applicationStatusHistory.findMany({
      where: { applicationId: id },
      orderBy: { changedAt: 'asc' },
      include: {
        changedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return rows.map((row) => ({
      ...row,
      id: row.id.toString(),
      fromStageLabel: row.fromStage ? STAGE_LABELS[row.fromStage] : null,
      toStageLabel: STAGE_LABELS[row.toStage],
    }));
  }

  // ===================================================================
  //  Stage transitions
  // ===================================================================

  /**
   * The single choke point for stage/status changes.
   *
   * Everything runs in one transaction: the application row, the history
   * row, the denormalised stage timestamp and -- when the application
   * ends -- the release of the duplicate-application key.
   */
  async transition(
    id: string,
    dto: TransitionDto,
    user: AuthenticatedUser,
    ip: string,
  ) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        job: { select: { id: true, title: true, requirementCode: true, vacancies: true } },
        candidate: {
          select: { id: true, fullName: true, user: { select: { email: true, firstName: true } } },
        },
      },
    });

    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(application, user);

    if (TERMINAL_APPLICATION_STATUSES.includes(application.status)) {
      throw new BadRequestException(
        `This application is ${application.status.toLowerCase()} and can no longer be moved`,
      );
    }

    const targetStage = dto.toStage ?? application.currentStage;
    const targetStatus = dto.toStatus ?? application.status;
    const isStatusOnlyChange = dto.toStage === undefined || dto.toStage === application.currentStage;

    if (!isStatusOnlyChange) {
      if (!isValidStageTransition(application.currentStage, targetStage)) {
        throw new BadRequestException(
          `Cannot move from ${STAGE_LABELS[application.currentStage]} to ` +
            `${STAGE_LABELS[targetStage]}. Stages advance in order and may ` +
            `only be stepped back by one.`,
        );
      }
    }

    if (targetStatus === ApplicationStatus.REJECTED && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required when rejecting an application');
    }

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - application.stageEnteredAt.getTime()) / 1000),
    );
    const becomesTerminal = TERMINAL_APPLICATION_STATUSES.includes(targetStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.jobApplication.update({
        where: { id },
        data: {
          currentStage: targetStage,
          status: targetStatus,
          // Releasing activeJobKey lets the candidate re-apply later,
          // while the unique index still blocks two live applications.
          activeJobKey: becomesTerminal ? null : application.jobId,
          ...(isStatusOnlyChange
            ? {}
            : { stageEnteredAt: now, followUpDueAt: this.followUpDate(targetStage) }),
          ...(targetStatus === ApplicationStatus.REJECTED
            ? { rejectionReason: dto.reason, followUpDueAt: null }
            : {}),
          ...(targetStatus === ApplicationStatus.WITHDRAWN
            ? { withdrawReason: dto.reason, followUpDueAt: null }
            : {}),
          ...(dto.screeningResult ? { screeningResult: dto.screeningResult } : {}),
          ...(dto.screeningRemarks ? { screeningRemarks: dto.screeningRemarks } : {}),
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStage: application.currentStage,
          toStage: targetStage,
          fromStatus: application.status,
          toStatus: targetStatus,
          changedById: user.userId,
          reason: dto.reason,
          durationSeconds,
        },
      });

      // Reaching HIRED consumes one vacancy, and fills close the job.
      if (targetStage === ApplicationStage.HIRED && targetStatus !== ApplicationStatus.REJECTED) {
        const job = await tx.jobRequirement.update({
          where: { id: application.jobId },
          data: { vacanciesFilled: { increment: 1 } },
        });
        if (job.vacanciesFilled >= job.vacancies && job.status === JobStatus.PUBLISHED) {
          await tx.jobRequirement.update({
            where: { id: job.id },
            data: { status: JobStatus.CLOSED, closedAt: now },
          });
        }
      }

      await tx.candidateActivity.create({
        data: {
          candidateId: application.candidateId,
          activity: 'STAGE_CHANGED',
          detail: `${STAGE_LABELS[application.currentStage]} -> ${STAGE_LABELS[targetStage]}`,
          actorUserId: user.userId,
        },
      });

      return result;
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.APPLICATION_STAGE_CHANGED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobApplication',
      entityId: id,
      metadata: {
        fromStage: application.currentStage,
        toStage: targetStage,
        fromStatus: application.status,
        toStatus: targetStatus,
        reason: dto.reason,
      },
      ipAddress: ip,
    });

    // Tell the candidate, but never leak the internal rejection reason.
    if (dto.notifyCandidate !== false) {
      await this.notifications.queueTemplate(
        targetStatus === ApplicationStatus.REJECTED
          ? 'application.rejected'
          : 'application.status_changed',
        application.candidate.user.email,
        {
          firstName: application.candidate.user.firstName,
          jobTitle: application.job.title,
          applicationCode: application.applicationCode,
          newStage: STAGE_LABELS[targetStage],
        },
      );
    }

    return { ...updated, stageLabel: STAGE_LABELS[updated.currentStage] };
  }

  /**
   * Bulk transition. Each application is processed independently so one
   * invalid row cannot roll back the others; the caller gets a per-id
   * result and can retry only what failed.
   */
  async bulkTransition(dto: BulkTransitionDto, user: AuthenticatedUser, ip: string) {
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const id of dto.applicationIds) {
      try {
        await this.transition(
          id,
          {
            toStage: dto.toStage,
            toStatus: dto.toStatus,
            reason: dto.reason,
            notifyCandidate: dto.notifyCandidate,
          },
          user,
          ip,
        );
        results.push({ id, ok: true });
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      requested: dto.applicationIds.length,
      succeeded: results.filter((entry) => entry.ok).length,
      failed: results.filter((entry) => !entry.ok).length,
      results,
    };
  }

  /** Candidate-initiated withdrawal of their own application. */
  async withdraw(id: string, reason: string | undefined, user: AuthenticatedUser, ip: string) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');

    if (!user.candidateId || application.candidateId !== user.candidateId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }

    return this.transition(
      id,
      { toStatus: ApplicationStatus.WITHDRAWN, reason, notifyCandidate: false },
      user,
      ip,
    );
  }

  async assignRecruiter(id: string, recruiterId: string, user: AuthenticatedUser, ip: string) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');

    const updated = await this.prisma.jobApplication.update({
      where: { id },
      data: { recruiterId },
    });

    await this.notifications.notifyUser({
      userId: recruiterId,
      title: 'Application assigned to you',
      body: `You are now handling application ${application.applicationCode}.`,
      link: `/applications/${id}`,
      category: 'APPLICATION',
    });

    await this.audit.log({
      action: 'APPLICATION_ASSIGNED',
      actorUserId: user.userId,
      entityType: 'JobApplication',
      entityId: id,
      metadata: { recruiterId },
      ipAddress: ip,
    });

    return updated;
  }

  // ===================================================================
  //  Notes
  // ===================================================================

  async addNote(id: string, body: string, isInternal: boolean, user: AuthenticatedUser) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(application, user);

    return this.prisma.applicationNote.create({
      data: { applicationId: id, authorId: user.userId, body, isInternal },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async listNotes(id: string, user: AuthenticatedUser) {
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(application, user);

    const isCandidate = this.isCandidateSelfView(application, user);

    return this.prisma.applicationNote.findMany({
      // A candidate never sees internal notes about themselves.
      where: { applicationId: id, ...(isCandidate ? { isInternal: false } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ===================================================================
  //  Pipeline (Kanban)
  // ===================================================================

  /** Candidate cards grouped by stage for one job requirement. */
  async pipeline(jobId: string, user: AuthenticatedUser, filters: { recruiterId?: string }) {
    const job = await this.prisma.jobRequirement.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        requirementCode: true,
        recruiterId: true,
        hiringManagerId: true,
        vacancies: true,
        vacanciesFilled: true,
      },
    });
    if (!job) throw new NotFoundException('Job not found');

    if (!user.permissions.includes(PERMISSIONS.APPLICATION_READ_ANY)) {
      const attached =
        job.recruiterId === user.userId || job.hiringManagerId === user.userId;
      if (!attached) throw new ForbiddenException('You do not have access to this pipeline');
    }

    const applications = await this.prisma.jobApplication.findMany({
      where: {
        jobId,
        status: { notIn: [ApplicationStatus.WITHDRAWN] },
        ...(filters.recruiterId ? { recruiterId: filters.recruiterId } : {}),
      },
      include: {
        candidate: {
          select: {
            id: true,
            candidateCode: true,
            fullName: true,
            totalExperience: true,
            skills: { include: { skill: { select: { name: true } } }, take: 5 },
            tags: { include: { tag: true } },
          },
        },
        recruiter: { select: { id: true, firstName: true, lastName: true } },
        interviews: {
          where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
          orderBy: { scheduledStart: 'asc' },
          take: 1,
          select: { id: true, scheduledStart: true, roundName: true },
        },
      },
      orderBy: { stageEnteredAt: 'asc' },
    });

    const now = Date.now();
    const columns = STAGE_ORDER.map((stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      count: 0,
      cards: [] as unknown[],
    }));
    const byStage = new Map(columns.map((column) => [column.stage, column]));

    for (const application of applications) {
      const column = byStage.get(application.currentStage);
      if (!column) continue;

      column.count += 1;
      column.cards.push({
        applicationId: application.id,
        applicationCode: application.applicationCode,
        candidateId: application.candidate.id,
        candidateCode: application.candidate.candidateCode,
        candidateName: application.candidate.fullName,
        experience: application.candidate.totalExperience,
        skills: application.candidate.skills.map((entry) => entry.skill.name),
        tags: application.candidate.tags.map((entry) => ({
          name: entry.tag.name,
          colour: entry.tag.colour,
        })),
        appliedAt: application.appliedAt,
        recruiter: application.recruiter,
        status: application.status,
        nextInterview: application.interviews[0] ?? null,
        stageEnteredAt: application.stageEnteredAt,
        followUpDueAt: application.followUpDueAt,
        isOverdue: Boolean(
          application.followUpDueAt &&
            application.followUpDueAt.getTime() < now &&
            application.status === ApplicationStatus.ACTIVE,
        ),
      });
    }

    return { job, columns, total: applications.length };
  }

  // ===================================================================

  private followUpDate(stage: ApplicationStage): Date | null {
    const days = STAGE_FOLLOWUP_DAYS[stage];
    if (!days) return null;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  async exportRows(query: ApplicationQueryDto, user: AuthenticatedUser) {
    const where = await this.scopedWhere(query, user);
    const rows = await this.prisma.jobApplication.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      take: 10000,
      include: {
        candidate: {
          select: {
            candidateCode: true,
            fullName: true,
            totalExperience: true,
            location: true,
            user: { select: { email: true } },
          },
        },
        job: { select: { requirementCode: true, title: true } },
        recruiter: { select: { firstName: true, lastName: true } },
        source: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      'Application ID': row.applicationCode,
      'Candidate ID': row.candidate.candidateCode,
      'Candidate Name': row.candidate.fullName,
      Email: row.candidate.user.email,
      Location: row.candidate.location ?? '',
      Experience: row.candidate.totalExperience?.toString() ?? '',
      'Job Code': row.job.requirementCode,
      'Job Title': row.job.title,
      Stage: STAGE_LABELS[row.currentStage],
      Status: row.status,
      'Screening Result': row.screeningResult,
      Source: row.source?.name ?? '',
      Recruiter: row.recruiter ? `${row.recruiter.firstName} ${row.recruiter.lastName}` : '',
      'Applied At': row.appliedAt.toISOString(),
      'Last Updated': row.lastUpdatedAt.toISOString(),
      'Rejection Reason': row.rejectionReason ?? '',
    }));
  }
}
