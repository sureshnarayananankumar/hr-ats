import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma, RoleName } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUDIT_ACTIONS, JOB_TRANSITIONS } from '../../common/constants';
import { generateJobCode, slugify } from '../../common/utils/codes.util';
import { buildPage, safeSort } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import type { CreateJobDto, JobQueryDto, UpdateJobDto } from './jobs.dto';

const SORTABLE = [
  'createdAt',
  'updatedAt',
  'title',
  'requirementCode',
  'status',
  'priority',
  'publishedAt',
  'applicationDeadline',
] as const;

/** Fields whose changes are recorded in the job history table. */
const TRACKED_FIELDS = [
  'title', 'description', 'responsibilities', 'qualifications', 'designation',
  'vacancies', 'employmentType', 'workMode', 'location', 'salaryMin', 'salaryMax',
  'priority', 'minExperience', 'maxExperience', 'applicationDeadline',
  'recruiterId', 'hiringManagerId', 'departmentId', 'status',
] as const;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===================================================================
  //  Read
  // ===================================================================

  async findAll(query: JobQueryDto, user: AuthenticatedUser) {
    const where = this.scopedWhere(query, user);
    const sortBy = safeSort(query.sortBy, SORTABLE, 'createdAt');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobRequirement.findMany({
        where,
        orderBy: { [sortBy]: query.sortDir },
        skip: query.skip,
        take: query.take,
        include: {
          department: { select: { id: true, name: true, code: true } },
          recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
          hiringManager: { select: { id: true, firstName: true, lastName: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          skills: { include: { skill: { select: { id: true, name: true } } } },
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.jobRequirement.count({ where }),
    ]);

    return buildPage(rows.map((row) => this.toListItem(row)), total, query);
  }

  /**
   * Builds the WHERE clause, applying both the user's filters and the
   * visibility rules for their role. Scoping happens here -- in the
   * query -- rather than by filtering results after the fact.
   */
  private scopedWhere(query: JobQueryDto, user: AuthenticatedUser): Prisma.JobRequirementWhereInput {
    const where: Prisma.JobRequirementWhereInput = {};

    if (query.status?.length) where.status = { in: query.status };
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.recruiterId) where.recruiterId = query.recruiterId;
    if (query.hiringManagerId) where.hiringManagerId = query.hiringManagerId;
    if (query.priority?.length) where.priority = { in: query.priority };
    if (query.employmentType?.length) where.employmentType = { in: query.employmentType };
    if (query.workMode?.length) where.workMode = { in: query.workMode };
    if (query.location) where.location = { contains: query.location };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { requirementCode: { contains: query.search } },
        { designation: { contains: query.search } },
        { location: { contains: query.search } },
      ];
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }

    // Users without job.read.any only see jobs they are attached to.
    if (!user.permissions.includes(PERMISSIONS.JOB_READ_ANY)) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { recruiterId: user.userId },
            { hiringManagerId: user.userId },
            { requestedById: user.userId },
            { createdById: user.userId },
          ],
        },
      ];
    }

    return where;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const job = await this.prisma.jobRequirement.findUnique({
      where: { id },
      include: {
        department: true,
        recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        hiringManager: { select: { id: true, firstName: true, lastName: true, email: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        skills: { include: { skill: true } },
        approvals: {
          include: { approver: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { sequence: 'asc' },
        },
        _count: { select: { applications: true, interviews: true } },
      },
    });

    if (!job) throw new NotFoundException('Job requirement not found');
    this.assertCanView(job, user);

    return job;
  }

  private assertCanView(
    job: { recruiterId: string | null; hiringManagerId: string | null; requestedById: string; createdById: string },
    user: AuthenticatedUser,
  ): void {
    if (user.permissions.includes(PERMISSIONS.JOB_READ_ANY)) return;

    const isAttached =
      job.recruiterId === user.userId ||
      job.hiringManagerId === user.userId ||
      job.requestedById === user.userId ||
      job.createdById === user.userId;

    if (!isAttached) {
      throw new ForbiddenException('You do not have access to this job requirement');
    }
  }

  async history(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user); // re-uses the access check
    const rows = await this.prisma.jobRequirementHistory.findMany({
      where: { jobId: id },
      orderBy: { changedAt: 'desc' },
      take: 500,
    });
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  }

  // ===================================================================
  //  Create / update
  // ===================================================================

  async create(dto: CreateJobDto, user: AuthenticatedUser, ip: string) {
    this.validateSalaryRange(dto.salaryMin, dto.salaryMax);
    this.validateExperienceRange(dto.minExperience, dto.maxExperience);

    const job = await this.prisma.$transaction(async (tx) => {
      const code = await generateJobCode(tx);
      const created = await tx.jobRequirement.create({
        data: {
          requirementCode: code,
          slug: slugify(dto.title, randomBytes(3).toString('hex')),
          title: dto.title,
          description: dto.description,
          responsibilities: dto.responsibilities,
          qualifications: dto.qualifications,
          internalNotes: dto.internalNotes,
          minExperience: dto.minExperience ?? 0,
          maxExperience: dto.maxExperience,
          departmentId: dto.departmentId,
          designation: dto.designation,
          vacancies: dto.vacancies ?? 1,
          employmentType: dto.employmentType,
          workMode: dto.workMode,
          location: dto.location,
          salaryMin: dto.salaryMin,
          salaryMax: dto.salaryMax,
          salaryCurrency: dto.salaryCurrency ?? 'USD',
          salaryConfidential: dto.salaryConfidential ?? true,
          priority: dto.priority,
          applicationDeadline: dto.applicationDeadline
            ? new Date(dto.applicationDeadline)
            : undefined,
          // requestedById defaults to the caller unless explicitly set
          // by an HR admin raising a request on someone's behalf.
          requestedById: dto.requestedById ?? user.userId,
          recruiterId: dto.recruiterId,
          hiringManagerId: dto.hiringManagerId,
          createdById: user.userId,
          status: JobStatus.DRAFT,
        },
      });

      if (dto.skills?.length) {
        await this.syncSkills(tx, created.id, dto.skills);
      }

      return created;
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.JOB_CREATED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobRequirement',
      entityId: job.id,
      metadata: { requirementCode: job.requirementCode, title: job.title },
      ipAddress: ip,
    });

    return job;
  }

  async update(id: string, dto: UpdateJobDto, user: AuthenticatedUser, ip: string) {
    const existing = await this.prisma.jobRequirement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job requirement not found');
    this.assertCanView(existing, user);

    // Published and closed jobs are deliberately immutable except via
    // the explicit status actions -- editing live job copy out from
    // under applicants would invalidate what they applied to.
    if (([JobStatus.CLOSED, JobStatus.CANCELLED] as JobStatus[]).includes(existing.status)) {
      throw new BadRequestException(
        `A ${existing.status.toLowerCase()} requirement cannot be edited`,
      );
    }

    this.validateSalaryRange(
      dto.salaryMin ?? Number(existing.salaryMin),
      dto.salaryMax ?? Number(existing.salaryMax),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.jobRequirement.update({
        where: { id },
        data: {
          ...this.pickDefined(dto, [
            'title', 'description', 'responsibilities', 'qualifications',
            'internalNotes', 'minExperience', 'maxExperience', 'departmentId',
            'designation', 'vacancies', 'employmentType', 'workMode', 'location',
            'salaryMin', 'salaryMax', 'salaryCurrency', 'salaryConfidential',
            'priority', 'recruiterId', 'hiringManagerId',
          ]),
          ...(dto.applicationDeadline !== undefined
            ? { applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : null }
            : {}),
        },
      });

      if (dto.skills) await this.syncSkills(tx, id, dto.skills);

      await this.recordFieldChanges(tx, id, user.userId, existing, result);
      return result;
    });

    return updated;
  }

  /** Writes one history row per changed tracked field. */
  private async recordFieldChanges(
    tx: Prisma.TransactionClient,
    jobId: string,
    userId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    reason?: string,
  ): Promise<void> {
    const rows = TRACKED_FIELDS.flatMap((field) => {
      const oldValue = before[field];
      const newValue = after[field];
      const oldText = oldValue === null || oldValue === undefined ? null : String(oldValue);
      const newText = newValue === null || newValue === undefined ? null : String(newValue);
      if (oldText === newText) return [];
      return [{
        jobId,
        changedById: userId,
        fieldName: field,
        oldValue: oldText,
        newValue: newText,
        reason: reason ?? null,
      }];
    });

    if (rows.length > 0) {
      await tx.jobRequirementHistory.createMany({ data: rows });
    }
  }

  private async syncSkills(
    tx: Prisma.TransactionClient,
    jobId: string,
    skills: Array<{ name: string; isRequired?: boolean; minYears?: number }>,
  ): Promise<void> {
    await tx.jobSkill.deleteMany({ where: { jobId } });

    for (const entry of skills) {
      const name = entry.name.trim();
      if (!name) continue;

      const skill = await tx.skill.upsert({
        where: { name },
        create: { name },
        update: {},
      });

      await tx.jobSkill.create({
        data: {
          jobId,
          skillId: skill.id,
          isRequired: entry.isRequired ?? true,
          minYears: entry.minYears,
        },
      });
    }
  }

  // ===================================================================
  //  Status workflow
  // ===================================================================

  /**
   * The single choke point for every status change.
   * Validates the transition against JOB_TRANSITIONS, applies the
   * side-effects for that status, and records history + audit.
   */
  async changeStatus(
    id: string,
    target: JobStatus,
    user: AuthenticatedUser,
    options: { reason?: string; ip: string },
  ) {
    const job = await this.prisma.jobRequirement.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job requirement not found');

    const allowed = JOB_TRANSITIONS[job.status];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot move a ${job.status} requirement to ${target}. ` +
          `Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }

    this.assertStatusPermission(target, user);

    if (target === JobStatus.PUBLISHED && job.status === JobStatus.APPROVED) {
      // Publishing requires a usable public listing.
      if (!job.description?.trim()) {
        throw new BadRequestException('A job must have a description before publishing');
      }
      if (job.applicationDeadline && job.applicationDeadline < new Date()) {
        throw new BadRequestException('The application deadline is already in the past');
      }
    }

    if (target === JobStatus.ON_HOLD && !options.reason) {
      throw new BadRequestException('A reason is required when putting a job on hold');
    }
    if (target === JobStatus.CANCELLED && !options.reason) {
      throw new BadRequestException('A reason is required when cancelling a job');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.jobRequirement.update({
        where: { id },
        data: {
          status: target,
          ...(target === JobStatus.PUBLISHED && !job.publishedAt
            ? { publishedAt: new Date() }
            : {}),
          ...(target === JobStatus.CLOSED ? { closedAt: new Date() } : {}),
          ...(target === JobStatus.PUBLISHED ? { closedAt: null, onHoldReason: null } : {}),
          ...(target === JobStatus.ON_HOLD ? { onHoldReason: options.reason } : {}),
          ...(target === JobStatus.CANCELLED ? { cancelReason: options.reason } : {}),
        },
      });

      await tx.jobRequirementHistory.create({
        data: {
          jobId: id,
          changedById: user.userId,
          fieldName: 'status',
          oldValue: job.status,
          newValue: target,
          reason: options.reason,
        },
      });

      return result;
    });

    await this.audit.log({
      action:
        target === JobStatus.PUBLISHED
          ? AUDIT_ACTIONS.JOB_PUBLISHED
          : AUDIT_ACTIONS.JOB_STATUS_CHANGED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobRequirement',
      entityId: id,
      metadata: { from: job.status, to: target, reason: options.reason },
      ipAddress: options.ip,
    });

    if (job.recruiterId && job.recruiterId !== user.userId) {
      await this.notifications.notifyUser({
        userId: job.recruiterId,
        title: `Job ${job.requirementCode} is now ${target}`,
        body: `"${job.title}" moved from ${job.status} to ${target}.`,
        link: `/jobs/${id}`,
        category: 'JOB',
      });
    }

    return updated;
  }

  private assertStatusPermission(target: JobStatus, user: AuthenticatedUser): void {
    const required: Partial<Record<JobStatus, string>> = {
      PENDING_APPROVAL: PERMISSIONS.JOB_SUBMIT,
      APPROVED: PERMISSIONS.JOB_APPROVE,
      PUBLISHED: PERMISSIONS.JOB_PUBLISH,
      ON_HOLD: PERMISSIONS.JOB_HOLD,
      CLOSED: PERMISSIONS.JOB_CLOSE,
      CANCELLED: PERMISSIONS.JOB_CANCEL,
    };
    const permission = required[target];
    if (permission && !user.permissions.includes(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  /** Submit for approval, creating the approval rows for each approver. */
  async submitForApproval(id: string, approverIds: string[], user: AuthenticatedUser, ip: string) {
    if (approverIds.length === 0) {
      throw new BadRequestException('At least one approver is required');
    }

    const approvers = await this.prisma.user.findMany({
      where: {
        id: { in: approverIds },
        status: 'ACTIVE',
        userRoles: {
          some: { role: { name: { in: [RoleName.HR_ADMIN, RoleName.SUPER_ADMIN] } } },
        },
      },
      select: { id: true, email: true, firstName: true },
    });

    if (approvers.length !== approverIds.length) {
      throw new BadRequestException(
        'One or more selected approvers are not authorised to approve job requirements',
      );
    }

    const job = await this.changeStatus(id, JobStatus.PENDING_APPROVAL, user, { ip });

    await this.prisma.$transaction(async (tx) => {
      await tx.jobApproval.deleteMany({ where: { jobId: id, decision: 'PENDING' } });
      await tx.jobApproval.createMany({
        data: approvers.map((approver, index) => ({
          jobId: id,
          approverId: approver.id,
          sequence: index + 1,
        })),
      });
    });

    await this.notifications.notifyMany(
      approvers.map((approver) => approver.id),
      {
        title: `Approval needed: ${job.requirementCode}`,
        body: `"${job.title}" has been submitted for your approval.`,
        link: `/job-approvals/${id}`,
        category: 'APPROVAL',
      },
    );

    for (const approver of approvers) {
      await this.notifications.queueTemplate('job.approval_requested', approver.email, {
        firstName: approver.firstName,
        jobTitle: job.title,
        requirementCode: job.requirementCode,
      });
    }

    await this.audit.log({
      action: AUDIT_ACTIONS.JOB_SUBMITTED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobRequirement',
      entityId: id,
      metadata: { approvers: approvers.length },
      ipAddress: ip,
    });

    return job;
  }

  /** Record an approve/reject decision for the calling approver. */
  async decideApproval(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    comments: string | undefined,
    user: AuthenticatedUser,
    ip: string,
  ) {
    const approval = await this.prisma.jobApproval.findFirst({
      where: { jobId: id, approverId: user.userId, decision: 'PENDING' },
    });

    if (!approval) {
      throw new ForbiddenException('You have no pending approval for this job requirement');
    }
    if (decision === 'REJECTED' && !comments?.trim()) {
      throw new BadRequestException('A comment is required when rejecting a requirement');
    }

    await this.prisma.jobApproval.update({
      where: { id: approval.id },
      data: { decision, comments, decidedAt: new Date() },
    });

    const job = await this.prisma.jobRequirement.findUniqueOrThrow({ where: { id } });

    if (decision === 'REJECTED') {
      // Any rejection sends the whole requirement back to draft.
      await this.prisma.$transaction([
        this.prisma.jobRequirement.update({
          where: { id },
          data: { status: JobStatus.DRAFT },
        }),
        this.prisma.jobRequirementHistory.create({
          data: {
            jobId: id,
            changedById: user.userId,
            fieldName: 'status',
            oldValue: job.status,
            newValue: JobStatus.DRAFT,
            reason: comments,
          },
        }),
      ]);

      await this.notifications.notifyUser({
        userId: job.requestedById,
        title: `Job ${job.requirementCode} was rejected`,
        body: comments ?? 'Your job requirement was returned for revision.',
        link: `/jobs/${id}`,
        category: 'APPROVAL',
      });

      await this.audit.log({
        action: AUDIT_ACTIONS.JOB_REJECTED,
        actorUserId: user.userId,
        actorEmail: user.email,
        entityType: 'JobRequirement',
        entityId: id,
        metadata: { comments },
        ipAddress: ip,
      });

      return { status: JobStatus.DRAFT, message: 'Requirement rejected and returned to draft' };
    }

    // Approved only once every approver has signed off.
    const stillPending = await this.prisma.jobApproval.count({
      where: { jobId: id, decision: 'PENDING' },
    });

    if (stillPending === 0) {
      await this.prisma.$transaction([
        this.prisma.jobRequirement.update({
          where: { id },
          data: { status: JobStatus.APPROVED },
        }),
        this.prisma.jobRequirementHistory.create({
          data: {
            jobId: id,
            changedById: user.userId,
            fieldName: 'status',
            oldValue: job.status,
            newValue: JobStatus.APPROVED,
            reason: comments,
          },
        }),
      ]);

      await this.notifications.notifyUser({
        userId: job.requestedById,
        title: `Job ${job.requirementCode} approved`,
        body: `"${job.title}" is approved and ready to publish.`,
        link: `/jobs/${id}`,
        category: 'APPROVAL',
      });
    }

    await this.audit.log({
      action: AUDIT_ACTIONS.JOB_APPROVED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobRequirement',
      entityId: id,
      metadata: { remainingApprovers: stillPending },
      ipAddress: ip,
    });

    return {
      status: stillPending === 0 ? JobStatus.APPROVED : JobStatus.PENDING_APPROVAL,
      remainingApprovers: stillPending,
      message: stillPending === 0 ? 'Requirement fully approved' : 'Your approval was recorded',
    };
  }

  /** Approvals waiting on the calling user. */
  async pendingApprovals(user: AuthenticatedUser) {
    return this.prisma.jobApproval.findMany({
      where: { approverId: user.userId, decision: 'PENDING' },
      include: {
        job: {
          include: {
            department: { select: { name: true } },
            requestedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ===================================================================
  //  Duplicate / assign
  // ===================================================================

  async duplicate(id: string, user: AuthenticatedUser, ip: string) {
    const source = await this.prisma.jobRequirement.findUnique({
      where: { id },
      include: { skills: true },
    });
    if (!source) throw new NotFoundException('Job requirement not found');

    const copy = await this.prisma.$transaction(async (tx) => {
      const code = await generateJobCode(tx);
      const created = await tx.jobRequirement.create({
        data: {
          requirementCode: code,
          slug: slugify(source.title, randomBytes(3).toString('hex')),
          title: `${source.title} (Copy)`,
          description: source.description,
          responsibilities: source.responsibilities,
          qualifications: source.qualifications,
          internalNotes: source.internalNotes,
          minExperience: source.minExperience,
          maxExperience: source.maxExperience,
          departmentId: source.departmentId,
          designation: source.designation,
          vacancies: source.vacancies,
          employmentType: source.employmentType,
          workMode: source.workMode,
          location: source.location,
          salaryMin: source.salaryMin,
          salaryMax: source.salaryMax,
          salaryCurrency: source.salaryCurrency,
          salaryConfidential: source.salaryConfidential,
          priority: source.priority,
          requestedById: user.userId,
          createdById: user.userId,
          recruiterId: source.recruiterId,
          hiringManagerId: source.hiringManagerId,
          duplicatedFromId: source.id,
          // A copy always starts clean: draft, unpublished, zero filled.
          status: JobStatus.DRAFT,
          vacanciesFilled: 0,
        },
      });

      if (source.skills.length > 0) {
        await tx.jobSkill.createMany({
          data: source.skills.map((skill) => ({
            jobId: created.id,
            skillId: skill.skillId,
            isRequired: skill.isRequired,
            minYears: skill.minYears,
          })),
        });
      }

      return created;
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.JOB_CREATED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'JobRequirement',
      entityId: copy.id,
      metadata: { duplicatedFrom: source.requirementCode },
      ipAddress: ip,
    });

    return copy;
  }

  async assignRecruiter(id: string, recruiterId: string, user: AuthenticatedUser, ip: string) {
    const recruiter = await this.prisma.user.findFirst({
      where: {
        id: recruiterId,
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              name: { in: [RoleName.RECRUITER, RoleName.HR_ADMIN, RoleName.SUPER_ADMIN] },
            },
          },
        },
      },
      select: { id: true, firstName: true },
    });
    if (!recruiter) throw new BadRequestException('That user is not an active recruiter');

    const before = await this.prisma.jobRequirement.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.jobRequirement.update({
      where: { id },
      data: { recruiterId },
    });

    await this.prisma.jobRequirementHistory.create({
      data: {
        jobId: id,
        changedById: user.userId,
        fieldName: 'recruiterId',
        oldValue: before.recruiterId,
        newValue: recruiterId,
      },
    });

    await this.notifications.notifyUser({
      userId: recruiterId,
      title: `You were assigned to ${before.requirementCode}`,
      body: `You are now the recruiter for "${before.title}".`,
      link: `/jobs/${id}`,
      category: 'JOB',
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.JOB_STATUS_CHANGED,
      actorUserId: user.userId,
      entityType: 'JobRequirement',
      entityId: id,
      metadata: { assignedRecruiter: recruiterId },
      ipAddress: ip,
    });

    return updated;
  }

  // ===================================================================
  //  Helpers
  // ===================================================================

  private validateSalaryRange(min?: number | null, max?: number | null): void {
    if (min != null && max != null && Number(min) > Number(max)) {
      throw new BadRequestException('Minimum salary cannot exceed maximum salary');
    }
  }

  private validateExperienceRange(min?: number | null, max?: number | null): void {
    if (min != null && max != null && min > max) {
      throw new BadRequestException('Minimum experience cannot exceed maximum experience');
    }
  }

  /** Copies only the keys the caller actually supplied (mass-assignment guard). */
  private pickDefined<T extends object, K extends keyof T>(
    source: T,
    keys: readonly K[],
  ): Partial<Pick<T, K>> {
    const result: Partial<Pick<T, K>> = {};
    for (const key of keys) {
      if (source[key] !== undefined) result[key] = source[key];
    }
    return result;
  }

  private toListItem(row: Record<string, any>) {
    return {
      id: row.id,
      requirementCode: row.requirementCode,
      title: row.title,
      slug: row.slug,
      status: row.status,
      priority: row.priority,
      designation: row.designation,
      department: row.department,
      location: row.location,
      employmentType: row.employmentType,
      workMode: row.workMode,
      vacancies: row.vacancies,
      vacanciesFilled: row.vacanciesFilled,
      minExperience: row.minExperience,
      maxExperience: row.maxExperience,
      salaryMin: row.salaryMin,
      salaryMax: row.salaryMax,
      salaryCurrency: row.salaryCurrency,
      recruiter: row.recruiter,
      hiringManager: row.hiringManager,
      requestedBy: row.requestedBy,
      skills: row.skills?.map((entry: any) => entry.skill?.name).filter(Boolean) ?? [],
      applicationCount: row._count?.applications ?? 0,
      publishedAt: row.publishedAt,
      applicationDeadline: row.applicationDeadline,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Flat rows for CSV / Excel export. */
  async exportRows(query: JobQueryDto, user: AuthenticatedUser) {
    const where = this.scopedWhere(query, user);
    const rows = await this.prisma.jobRequirement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        department: { select: { name: true } },
        recruiter: { select: { firstName: true, lastName: true } },
        hiringManager: { select: { firstName: true, lastName: true } },
        _count: { select: { applications: true } },
      },
    });

    return rows.map((row) => ({
      'Requirement ID': row.requirementCode,
      Title: row.title,
      Department: row.department?.name ?? '',
      Designation: row.designation,
      Status: row.status,
      Priority: row.priority,
      Location: row.location,
      'Employment Type': row.employmentType,
      'Work Mode': row.workMode,
      Vacancies: row.vacancies,
      'Vacancies Filled': row.vacanciesFilled,
      'Min Experience': row.minExperience,
      'Max Experience': row.maxExperience ?? '',
      'Salary Min': row.salaryMin?.toString() ?? '',
      'Salary Max': row.salaryMax?.toString() ?? '',
      Currency: row.salaryCurrency,
      Recruiter: row.recruiter ? `${row.recruiter.firstName} ${row.recruiter.lastName}` : '',
      'Hiring Manager': row.hiringManager
        ? `${row.hiringManager.firstName} ${row.hiringManager.lastName}`
        : '',
      Applications: row._count.applications,
      'Published At': row.publishedAt?.toISOString() ?? '',
      'Application Deadline': row.applicationDeadline?.toISOString() ?? '',
      'Created At': row.createdAt.toISOString(),
    }));
  }
}
