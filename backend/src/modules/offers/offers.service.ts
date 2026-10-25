import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  OfferStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUDIT_ACTIONS, OFFER_TRANSITIONS } from '../../common/constants';
import { generateOfferCode, generateOnboardingCode } from '../../common/utils/codes.util';
import { buildPage } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import type { CreateOfferDto, OfferQueryDto, RespondToOfferDto, UpdateOfferDto } from './offers.dto';

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===================================================================
  //  Create / update
  // ===================================================================

  async create(dto: CreateOfferDto, user: AuthenticatedUser, ip: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: dto.applicationId },
      include: {
        candidate: { select: { id: true, fullName: true } },
        job: { select: { id: true, title: true, requirementCode: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (['REJECTED', 'WITHDRAWN'].includes(application.status)) {
      throw new BadRequestException(
        'Cannot raise an offer for a rejected or withdrawn application',
      );
    }

    const liveOffer = await this.prisma.offer.findFirst({
      where: {
        applicationId: dto.applicationId,
        status: { notIn: [OfferStatus.DECLINED, OfferStatus.WITHDRAWN, OfferStatus.EXPIRED] },
      },
    });
    if (liveOffer) {
      throw new BadRequestException(
        `An active offer (${liveOffer.offerCode}) already exists for this application`,
      );
    }

    const joiningDate = new Date(dto.joiningDate);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    if (expiresAt && expiresAt > joiningDate) {
      throw new BadRequestException('The offer expiry cannot be after the joining date');
    }

    const offer = await this.prisma.$transaction(async (tx) => {
      return tx.offer.create({
        data: {
          offerCode: await generateOfferCode(tx),
          applicationId: dto.applicationId,
          candidateId: application.candidateId,
          jobId: application.jobId,
          proposedDesignation: dto.proposedDesignation,
          departmentName: dto.departmentName,
          annualSalary: dto.annualSalary,
          currency: dto.currency ?? 'USD',
          bonus: dto.bonus,
          benefits: dto.benefits,
          joiningDate,
          expiresAt,
          createdById: user.userId,
          status: OfferStatus.DRAFT,
        },
      });
    });

    await this.recordHistory(offer.id, null, OfferStatus.DRAFT, user.userId);

    await this.audit.log({
      action: AUDIT_ACTIONS.OFFER_CREATED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'Offer',
      entityId: offer.id,
      // Salary is intentionally not written to the audit metadata.
      metadata: { applicationId: dto.applicationId, offerCode: offer.offerCode },
      ipAddress: ip,
    });

    return offer;
  }

  async update(id: string, dto: UpdateOfferDto, user: AuthenticatedUser) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');

    // Terms are frozen once the offer has left the building.
    if (!([OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL] as OfferStatus[]).includes(offer.status)) {
      throw new BadRequestException(
        `A ${offer.status.toLowerCase()} offer can no longer be edited`,
      );
    }

    return this.prisma.offer.update({
      where: { id },
      data: {
        ...(dto.proposedDesignation !== undefined
          ? { proposedDesignation: dto.proposedDesignation }
          : {}),
        ...(dto.departmentName !== undefined ? { departmentName: dto.departmentName } : {}),
        ...(dto.annualSalary !== undefined ? { annualSalary: dto.annualSalary } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.bonus !== undefined ? { bonus: dto.bonus } : {}),
        ...(dto.benefits !== undefined ? { benefits: dto.benefits } : {}),
        ...(dto.joiningDate !== undefined ? { joiningDate: new Date(dto.joiningDate) } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        revision: { increment: 1 },
      },
    });
  }

  // ===================================================================
  //  Workflow
  // ===================================================================

  private async transitionTo(
    id: string,
    target: OfferStatus,
    user: AuthenticatedUser,
    reason?: string,
  ) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');

    const allowed = OFFER_TRANSITIONS[offer.status];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot move a ${offer.status} offer to ${target}. ` +
          `Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }

    return { offer, allowed };
  }

  async submitForApproval(id: string, approverIds: string[], user: AuthenticatedUser, ip: string) {
    await this.transitionTo(id, OfferStatus.PENDING_APPROVAL, user);

    if (approverIds.length === 0) {
      throw new BadRequestException('At least one approver is required');
    }

    const offer = await this.prisma.$transaction(async (tx) => {
      await tx.offerApproval.deleteMany({ where: { offerId: id, decision: 'PENDING' } });
      await tx.offerApproval.createMany({
        data: approverIds.map((approverId, index) => ({
          offerId: id,
          approverId,
          sequence: index + 1,
        })),
      });
      return tx.offer.update({
        where: { id },
        data: { status: OfferStatus.PENDING_APPROVAL },
      });
    });

    await this.recordHistory(id, OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, user.userId);

    await this.notifications.notifyMany(approverIds, {
      title: `Offer approval needed: ${offer.offerCode}`,
      body: 'An offer is waiting for your approval.',
      link: `/offers/${id}`,
      category: 'OFFER',
    });

    return offer;
  }

  async decideApproval(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    comments: string | undefined,
    user: AuthenticatedUser,
    ip: string,
  ) {
    const approval = await this.prisma.offerApproval.findFirst({
      where: { offerId: id, approverId: user.userId, decision: 'PENDING' },
    });
    if (!approval) {
      throw new ForbiddenException('You have no pending approval for this offer');
    }
    if (decision === 'REJECTED' && !comments?.trim()) {
      throw new BadRequestException('A comment is required when rejecting an offer');
    }

    await this.prisma.offerApproval.update({
      where: { id: approval.id },
      data: { decision, comments, decidedAt: new Date() },
    });

    if (decision === 'REJECTED') {
      await this.prisma.offer.update({
        where: { id },
        data: { status: OfferStatus.DRAFT },
      });
      await this.recordHistory(
        id,
        OfferStatus.PENDING_APPROVAL,
        OfferStatus.DRAFT,
        user.userId,
        comments,
      );
      return { status: OfferStatus.DRAFT, message: 'Offer returned to draft' };
    }

    const pending = await this.prisma.offerApproval.count({
      where: { offerId: id, decision: 'PENDING' },
    });

    if (pending === 0) {
      await this.prisma.offer.update({
        where: { id },
        data: { status: OfferStatus.APPROVED },
      });
      await this.recordHistory(
        id,
        OfferStatus.PENDING_APPROVAL,
        OfferStatus.APPROVED,
        user.userId,
      );

      await this.audit.log({
        action: AUDIT_ACTIONS.OFFER_APPROVED,
        actorUserId: user.userId,
        actorEmail: user.email,
        entityType: 'Offer',
        entityId: id,
        ipAddress: ip,
      });
    }

    return {
      status: pending === 0 ? OfferStatus.APPROVED : OfferStatus.PENDING_APPROVAL,
      remainingApprovers: pending,
    };
  }

  /**
   * Sends an approved offer to the candidate.
   *
   * This moves the application to OFFER_RELEASED -- deliberately NOT to
   * HIRED. A candidate becomes hired only after they accept and HR
   * completes onboarding.
   */
  async send(id: string, user: AuthenticatedUser, ip: string) {
    const { offer } = await this.transitionTo(id, OfferStatus.SENT, user);

    const full = await this.prisma.offer.findUniqueOrThrow({
      where: { id },
      include: {
        candidate: {
          select: { fullName: true, user: { select: { email: true, firstName: true } } },
        },
        job: { select: { title: true } },
        application: { select: { id: true, currentStage: true, status: true } },
      },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.offer.update({
        where: { id },
        data: { status: OfferStatus.SENT, issuedAt: new Date() },
      });

      // Advance the pipeline, but only as far as "offer released".
      if (full.application.currentStage !== ApplicationStage.OFFER_RELEASED) {
        await tx.jobApplication.update({
          where: { id: full.applicationId },
          data: {
            currentStage: ApplicationStage.OFFER_RELEASED,
            stageEnteredAt: new Date(),
          },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: full.applicationId,
            fromStage: full.application.currentStage,
            toStage: ApplicationStage.OFFER_RELEASED,
            fromStatus: full.application.status,
            toStatus: full.application.status,
            changedById: user.userId,
            reason: `Offer ${offer.offerCode} sent`,
          },
        });
      }

      return result;
    });

    await this.recordHistory(id, OfferStatus.APPROVED, OfferStatus.SENT, user.userId);

    await this.notifications.queueTemplate('offer.sent', full.candidate.user.email, {
      firstName: full.candidate.user.firstName,
      jobTitle: full.job.title,
      offerCode: full.offerCode,
      joiningDate: full.joiningDate.toDateString(),
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.OFFER_SENT,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'Offer',
      entityId: id,
      ipAddress: ip,
    });

    return updated;
  }

  /**
   * Candidate accepts or declines their own offer.
   * Acceptance opens an onboarding record in the same transaction.
   */
  async respond(id: string, dto: RespondToOfferDto, user: AuthenticatedUser, ip: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: {
        candidate: { select: { id: true, userId: true, fullName: true } },
        job: { select: { title: true, departmentId: true, recruiterId: true } },
        application: { select: { id: true, currentStage: true, status: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    if (offer.candidate.userId !== user.userId) {
      throw new ForbiddenException('You can only respond to your own offer');
    }
    if (offer.status !== OfferStatus.SENT) {
      throw new BadRequestException('This offer is not awaiting a response');
    }
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      await this.prisma.offer.update({
        where: { id },
        data: { status: OfferStatus.EXPIRED },
      });
      throw new BadRequestException('This offer has expired');
    }
    if (dto.accept === false && !dto.declineReason?.trim()) {
      throw new BadRequestException('Please tell us why you are declining');
    }

    const target = dto.accept ? OfferStatus.ACCEPTED : OfferStatus.DECLINED;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.offer.update({
        where: { id },
        data: {
          status: target,
          respondedAt: new Date(),
          ...(dto.accept ? {} : { declineReason: dto.declineReason }),
        },
      });

      if (dto.accept) {
        await tx.jobApplication.update({
          where: { id: offer.applicationId },
          data: {
            currentStage: ApplicationStage.OFFER_ACCEPTED,
            stageEnteredAt: new Date(),
          },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: offer.applicationId,
            fromStage: offer.application.currentStage,
            toStage: ApplicationStage.OFFER_ACCEPTED,
            fromStatus: offer.application.status,
            toStatus: offer.application.status,
            changedById: user.userId,
            reason: 'Candidate accepted the offer',
          },
        });

        // Onboarding starts at OFFER_ACCEPTED -- not "joined".
        await tx.onboardingRecord.create({
          data: {
            onboardingCode: await generateOnboardingCode(tx),
            applicationId: offer.applicationId,
            offerId: offer.id,
            candidateId: offer.candidateId,
            status: 'OFFER_ACCEPTED',
            joiningDate: offer.joiningDate,
            designation: offer.proposedDesignation,
            departmentId: offer.job.departmentId,
          },
        });
      } else {
        // Declining ends the application and frees the duplicate guard.
        await tx.jobApplication.update({
          where: { id: offer.applicationId },
          data: {
            status: ApplicationStatus.OFFER_DECLINED,
            activeJobKey: null,
          },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: offer.applicationId,
            fromStage: offer.application.currentStage,
            toStage: offer.application.currentStage,
            fromStatus: offer.application.status,
            toStatus: ApplicationStatus.OFFER_DECLINED,
            changedById: user.userId,
            reason: dto.declineReason,
          },
        });
      }

      return updated;
    });

    await this.recordHistory(id, OfferStatus.SENT, target, user.userId, dto.declineReason);

    if (offer.job.recruiterId) {
      await this.notifications.notifyUser({
        userId: offer.job.recruiterId,
        title: `Offer ${offer.offerCode} ${dto.accept ? 'accepted' : 'declined'}`,
        body: `${offer.candidate.fullName} ${
          dto.accept ? 'accepted' : 'declined'
        } the offer for "${offer.job.title}".`,
        link: `/offers/${id}`,
        category: 'OFFER',
      });
    }

    await this.audit.log({
      action: AUDIT_ACTIONS.OFFER_RESPONDED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'Offer',
      entityId: id,
      metadata: { decision: target, reason: dto.declineReason },
      ipAddress: ip,
    });

    return result;
  }

  async withdraw(id: string, reason: string, user: AuthenticatedUser, ip: string) {
    const { offer } = await this.transitionTo(id, OfferStatus.WITHDRAWN, user);

    const updated = await this.prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.WITHDRAWN, withdrawReason: reason },
    });

    await this.recordHistory(id, offer.status, OfferStatus.WITHDRAWN, user.userId, reason);

    await this.audit.log({
      action: 'OFFER_WITHDRAWN',
      actorUserId: user.userId,
      entityType: 'Offer',
      entityId: id,
      metadata: { reason },
      ipAddress: ip,
    });

    return updated;
  }

  // ===================================================================
  //  Read
  // ===================================================================

  async findAll(query: OfferQueryDto, user: AuthenticatedUser) {
    const where: Prisma.OfferWhereInput = {};

    if (query.status?.length) where.status = { in: query.status };
    if (query.jobId) where.jobId = query.jobId;
    if (query.candidateId) where.candidateId = query.candidateId;

    const canReadAll = user.permissions.includes(PERMISSIONS.OFFER_READ_ANY);
    if (!canReadAll) {
      if (!user.candidateId) throw new ForbiddenException('You do not have access to offers');
      where.candidateId = user.candidateId;
      // A candidate never sees drafts or in-flight approvals.
      where.status = {
        in: [OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED],
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          candidate: { select: { id: true, candidateCode: true, fullName: true } },
          job: { select: { id: true, title: true, requirementCode: true } },
          application: { select: { id: true, applicationCode: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.offer.count({ where }),
    ]);

    return buildPage(rows, total, query);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: {
        candidate: {
          select: { id: true, userId: true, candidateCode: true, fullName: true },
        },
        job: { select: { id: true, title: true, requirementCode: true } },
        application: { select: { id: true, applicationCode: true, currentStage: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvals: {
          include: { approver: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { sequence: 'asc' },
        },
        history: { orderBy: { changedAt: 'desc' } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const canReadAll = user.permissions.includes(PERMISSIONS.OFFER_READ_ANY);
    const isOwner = offer.candidate.userId === user.userId;

    if (!canReadAll && !isOwner) {
      await this.audit.log({
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
        actorUserId: user.userId,
        entityType: 'Offer',
        entityId: id,
        severity: 'WARN',
      });
      throw new ForbiddenException('You do not have access to this offer');
    }

    // A candidate must not see an offer that has not been sent yet, nor
    // the internal approval chain behind it.
    if (!canReadAll && isOwner) {
      if (
        ([OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED] as OfferStatus[]).includes(
          offer.status,
        )
      ) {
        throw new NotFoundException('Offer not found');
      }
      return { ...offer, approvals: undefined, history: undefined };
    }

    return {
      ...offer,
      history: offer.history.map((row) => ({ ...row, id: row.id.toString() })),
    };
  }

  private async recordHistory(
    offerId: string,
    fromStatus: OfferStatus | null,
    toStatus: OfferStatus,
    changedById: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.offerHistory.create({
      data: { offerId, fromStatus, toStatus, changedById, reason },
    });
  }

  /** Scheduled sweep that expires offers past their expiry date. */
  async expireOverdueOffers(): Promise<number> {
    const result = await this.prisma.offer.updateMany({
      where: { status: OfferStatus.SENT, expiresAt: { lt: new Date() } },
      data: { status: OfferStatus.EXPIRED },
    });
    return result.count;
  }
}
