import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  JobStatus,
  OnboardingStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUDIT_ACTIONS } from '../../common/constants';
import { buildPage } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import type {
  CreateTaskDto,
  OnboardingQueryDto,
  UpdateOnboardingDto,
  UpdateTaskDto,
} from './onboarding.dto';

/** Seeded for every new joiner so nothing is forgotten. */
const DEFAULT_TASKS: Array<{ title: string; category: string; isMandatory: boolean }> = [
  { title: 'Collect signed offer letter', category: 'DOCUMENTATION', isMandatory: true },
  { title: 'Verify identity documents', category: 'DOCUMENTATION', isMandatory: true },
  { title: 'Verify education certificates', category: 'DOCUMENTATION', isMandatory: true },
  { title: 'Collect previous experience letters', category: 'DOCUMENTATION', isMandatory: false },
  { title: 'Background verification', category: 'HR', isMandatory: true },
  { title: 'Create employee record and payroll setup', category: 'HR', isMandatory: true },
  { title: 'Provision laptop and accessories', category: 'IT', isMandatory: true },
  { title: 'Create email and system accounts', category: 'IT', isMandatory: true },
  { title: 'Assign reporting manager and buddy', category: 'HR', isMandatory: true },
  { title: 'Schedule day-one orientation', category: 'TRAINING', isMandatory: true },
];

/**
 * Valid onboarding progressions.
 * Joined and Did-Not-Join are terminal, and are tracked separately from
 * the offer's own ACCEPTED state.
 */
const ONBOARDING_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  OFFER_ACCEPTED: ['PREBOARDING', 'DID_NOT_JOIN'],
  PREBOARDING: ['JOINED', 'DID_NOT_JOIN'],
  JOINED: [],
  DID_NOT_JOIN: [],
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: OnboardingQueryDto, user: AuthenticatedUser) {
    const where: Prisma.OnboardingRecordWhereInput = {};

    if (query.status?.length) where.status = { in: query.status };
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.joiningFrom || query.joiningTo) {
      where.joiningDate = {
        ...(query.joiningFrom ? { gte: new Date(query.joiningFrom) } : {}),
        ...(query.joiningTo ? { lte: new Date(query.joiningTo) } : {}),
      };
    }

    if (!user.permissions.includes(PERMISSIONS.ONBOARDING_READ_ANY)) {
      if (!user.candidateId) throw new ForbiddenException('You do not have access to onboarding');
      where.candidateId = user.candidateId;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.onboardingRecord.findMany({
        where,
        orderBy: { joiningDate: 'asc' },
        skip: query.skip,
        take: query.take,
        include: {
          candidate: { select: { id: true, candidateCode: true, fullName: true } },
          department: { select: { id: true, name: true } },
          reportingManager: { select: { id: true, firstName: true, lastName: true } },
          offer: { select: { id: true, offerCode: true } },
          tasks: { select: { id: true, status: true, isMandatory: true } },
        },
      }),
      this.prisma.onboardingRecord.count({ where }),
    ]);

    const data = rows.map((row) => {
      const completed = row.tasks.filter((task) => task.status === TaskStatus.COMPLETED).length;
      return {
        ...row,
        tasks: undefined,
        taskSummary: {
          total: row.tasks.length,
          completed,
          percentComplete:
            row.tasks.length > 0 ? Math.round((completed / row.tasks.length) * 100) : 0,
        },
      };
    });

    return buildPage(data, total, query);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const record = await this.prisma.onboardingRecord.findUnique({
      where: { id },
      include: {
        candidate: {
          select: {
            id: true,
            userId: true,
            candidateCode: true,
            fullName: true,
            user: { select: { email: true, phone: true } },
          },
        },
        department: { select: { id: true, name: true } },
        reportingManager: { select: { id: true, firstName: true, lastName: true } },
        offer: {
          select: {
            id: true,
            offerCode: true,
            proposedDesignation: true,
            joiningDate: true,
            annualSalary: true,
            currency: true,
          },
        },
        application: { select: { id: true, applicationCode: true } },
        tasks: {
          orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
          include: { owner: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!record) throw new NotFoundException('Onboarding record not found');

    const canReadAll = user.permissions.includes(PERMISSIONS.ONBOARDING_READ_ANY);
    const isOwner = record.candidate.userId === user.userId;
    if (!canReadAll && !isOwner) {
      throw new ForbiddenException('You do not have access to this onboarding record');
    }

    // Compensation on the offer is HR-only detail in this view.
    if (!canReadAll) {
      return {
        ...record,
        offer: record.offer
          ? { ...record.offer, annualSalary: undefined, currency: undefined }
          : null,
      };
    }

    return record;
  }

  /** Seeds the default checklist. Safe to call once per record. */
  async initialiseTasks(id: string, user: AuthenticatedUser) {
    const record = await this.prisma.onboardingRecord.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!record) throw new NotFoundException('Onboarding record not found');
    if (record._count.tasks > 0) {
      throw new BadRequestException('Tasks have already been created for this record');
    }

    const dueDate = new Date(record.joiningDate);
    await this.prisma.onboardingTask.createMany({
      data: DEFAULT_TASKS.map((task, index) => ({
        onboardingId: id,
        title: task.title,
        category: task.category,
        isMandatory: task.isMandatory,
        sequence: index,
        dueDate,
      })),
    });

    return this.findOne(id, user);
  }

  async update(id: string, dto: UpdateOnboardingDto, user: AuthenticatedUser, ip: string) {
    const record = await this.prisma.onboardingRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Onboarding record not found');

    if (dto.status && dto.status !== record.status) {
      const allowed = ONBOARDING_TRANSITIONS[record.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot move onboarding from ${record.status} to ${dto.status}. ` +
            `Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        );
      }
      if (dto.status === OnboardingStatus.DID_NOT_JOIN && !dto.didNotJoinReason?.trim()) {
        throw new BadRequestException('A reason is required when marking "did not join"');
      }
      if (dto.status === OnboardingStatus.JOINED) {
        const outstanding = await this.prisma.onboardingTask.count({
          where: {
            onboardingId: id,
            isMandatory: true,
            status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
          },
        });
        if (outstanding > 0) {
          throw new BadRequestException(
            `${outstanding} mandatory onboarding task(s) are still open`,
          );
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.onboardingRecord.update({
        where: { id },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.joiningDate !== undefined
            ? { joiningDate: new Date(dto.joiningDate) }
            : {}),
          ...(dto.actualJoinDate !== undefined
            ? { actualJoinDate: dto.actualJoinDate ? new Date(dto.actualJoinDate) : null }
            : {}),
          ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
          ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
          ...(dto.reportingManagerId !== undefined
            ? { reportingManagerId: dto.reportingManagerId }
            : {}),
          ...(dto.employeeCode !== undefined ? { employeeCode: dto.employeeCode } : {}),
          ...(dto.documentsVerified !== undefined
            ? {
                documentsVerified: dto.documentsVerified,
                verifiedAt: dto.documentsVerified ? new Date() : null,
              }
            : {}),
          ...(dto.didNotJoinReason !== undefined
            ? { didNotJoinReason: dto.didNotJoinReason }
            : {}),
          ...(dto.status === OnboardingStatus.JOINED && !record.actualJoinDate
            ? { actualJoinDate: new Date() }
            : {}),
        },
      });

      // Joining is the ONLY thing that marks the application HIRED.
      if (dto.status === OnboardingStatus.JOINED) {
        const application = await tx.jobApplication.findUniqueOrThrow({
          where: { id: record.applicationId },
        });

        await tx.jobApplication.update({
          where: { id: record.applicationId },
          data: {
            currentStage: ApplicationStage.HIRED,
            status: ApplicationStatus.HIRED,
            activeJobKey: null,
            stageEnteredAt: new Date(),
          },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId: record.applicationId,
            fromStage: application.currentStage,
            toStage: ApplicationStage.HIRED,
            fromStatus: application.status,
            toStatus: ApplicationStatus.HIRED,
            changedById: user.userId,
            reason: 'Candidate joined',
          },
        });

        const job = await tx.jobRequirement.update({
          where: { id: application.jobId },
          data: { vacanciesFilled: { increment: 1 } },
        });
        if (job.vacanciesFilled >= job.vacancies && job.status === JobStatus.PUBLISHED) {
          await tx.jobRequirement.update({
            where: { id: job.id },
            data: { status: JobStatus.CLOSED, closedAt: new Date() },
          });
        }
      }

      // Did-not-join releases the application without marking it hired.
      if (dto.status === OnboardingStatus.DID_NOT_JOIN) {
        const application = await tx.jobApplication.findUniqueOrThrow({
          where: { id: record.applicationId },
        });
        await tx.jobApplication.update({
          where: { id: record.applicationId },
          data: { status: ApplicationStatus.OFFER_DECLINED, activeJobKey: null },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: record.applicationId,
            fromStage: application.currentStage,
            toStage: application.currentStage,
            fromStatus: application.status,
            toStatus: ApplicationStatus.OFFER_DECLINED,
            changedById: user.userId,
            reason: dto.didNotJoinReason ?? 'Candidate did not join',
          },
        });
      }

      return result;
    });

    if (dto.status) {
      await this.audit.log({
        action: AUDIT_ACTIONS.ONBOARDING_STARTED,
        actorUserId: user.userId,
        actorEmail: user.email,
        entityType: 'OnboardingRecord',
        entityId: id,
        metadata: { from: record.status, to: dto.status },
        ipAddress: ip,
      });
    }

    return updated;
  }

  // ===================================================================
  //  Tasks
  // ===================================================================

  async addTask(id: string, dto: CreateTaskDto, user: AuthenticatedUser) {
    const record = await this.prisma.onboardingRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Onboarding record not found');

    const maxSequence = await this.prisma.onboardingTask.aggregate({
      where: { onboardingId: id },
      _max: { sequence: true },
    });

    return this.prisma.onboardingTask.create({
      data: {
        onboardingId: id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        ownerUserId: dto.ownerUserId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        isMandatory: dto.isMandatory ?? true,
        sequence: (maxSequence._max.sequence ?? -1) + 1,
      },
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateTask(taskId: string, dto: UpdateTaskDto, user: AuthenticatedUser) {
    const task = await this.prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.ownerUserId !== undefined ? { ownerUserId: dto.ownerUserId } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              completedAt: dto.status === TaskStatus.COMPLETED ? new Date() : null,
            }
          : {}),
      },
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (dto.ownerUserId && dto.ownerUserId !== task.ownerUserId) {
      await this.notifications.notifyUser({
        userId: dto.ownerUserId,
        title: 'Onboarding task assigned to you',
        body: updated.title,
        link: `/onboarding/${task.onboardingId}`,
        category: 'ONBOARDING',
      });
    }

    return updated;
  }

  async removeTask(taskId: string) {
    await this.prisma.onboardingTask.delete({ where: { id: taskId } });
    return { message: 'Task removed' };
  }

  /** Tasks assigned to the current user across all onboarding records. */
  async myTasks(user: AuthenticatedUser) {
    return this.prisma.onboardingTask.findMany({
      where: {
        ownerUserId: user.userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      },
      orderBy: [{ dueDate: 'asc' }],
      include: {
        onboarding: {
          select: {
            id: true,
            onboardingCode: true,
            joiningDate: true,
            candidate: { select: { fullName: true } },
          },
        },
      },
    });
  }
}
