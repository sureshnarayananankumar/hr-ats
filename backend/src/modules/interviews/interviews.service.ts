import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InterviewStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUDIT_ACTIONS } from '../../common/constants';
import { generateInterviewCode } from '../../common/utils/codes.util';
import { buildPage } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import type {
  FeedbackDto,
  InterviewQueryDto,
  RescheduleDto,
  ScheduleInterviewDto,
} from './interviews.dto';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===================================================================
  //  Scheduling
  // ===================================================================

  async schedule(dto: ScheduleInterviewDto, user: AuthenticatedUser, ip: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: dto.applicationId },
      include: {
        candidate: {
          select: { id: true, fullName: true, user: { select: { email: true, firstName: true } } },
        },
        job: { select: { id: true, title: true, requirementCode: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (['REJECTED', 'WITHDRAWN', 'HIRED'].includes(application.status)) {
      throw new BadRequestException(
        `Cannot schedule an interview for a ${application.status.toLowerCase()} application`,
      );
    }

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (end <= start) {
      throw new BadRequestException('The interview must end after it starts');
    }
    if (start < new Date()) {
      throw new BadRequestException('Interviews cannot be scheduled in the past');
    }

    const conflicts = await this.findConflicts(dto.interviewerIds, start, end);

    const interview = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          interviewCode: await generateInterviewCode(tx),
          applicationId: dto.applicationId,
          candidateId: application.candidateId,
          jobId: application.jobId,
          round: dto.round ?? 1,
          roundName: dto.roundName,
          interviewType: dto.interviewType,
          scheduledStart: start,
          scheduledEnd: end,
          timeZone: dto.timeZone ?? 'UTC',
          meetingLink: dto.meetingLink,
          venue: dto.venue,
          instructions: dto.instructions,
          organiserId: user.userId,
          status: InterviewStatus.SCHEDULED,
        },
      });

      await tx.interviewPanelMember.createMany({
        data: dto.interviewerIds.map((interviewerId, index) => ({
          interviewId: created.id,
          interviewerId,
          isLead: index === 0,
        })),
      });

      return created;
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.INTERVIEW_SCHEDULED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'Interview',
      entityId: interview.id,
      metadata: {
        applicationId: dto.applicationId,
        panelSize: dto.interviewerIds.length,
        hadConflicts: conflicts.length > 0,
      },
      ipAddress: ip,
    });

    await this.notifyPanel(interview.id, dto.interviewerIds, application.job.title, start);

    await this.notifications.queueTemplate(
      'interview.invitation',
      application.candidate.user.email,
      {
        firstName: application.candidate.user.firstName,
        jobTitle: application.job.title,
        roundName: dto.roundName,
        scheduledAt: start.toISOString(),
        meetingLink: dto.meetingLink ?? dto.venue ?? 'Details to follow',
      },
    );

    // Conflicts are surfaced as a warning rather than a hard block --
    // HR routinely double-books deliberately and should decide.
    return { ...interview, conflicts };
  }

  /** Panel members already booked in an overlapping slot. */
  private async findConflicts(interviewerIds: string[], start: Date, end: Date) {
    if (interviewerIds.length === 0) return [];

    const overlapping = await this.prisma.interview.findMany({
      where: {
        status: { in: [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED] },
        // Two ranges overlap iff each starts before the other ends.
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        panel: { some: { interviewerId: { in: interviewerIds } } },
      },
      select: {
        id: true,
        interviewCode: true,
        scheduledStart: true,
        scheduledEnd: true,
        panel: {
          where: { interviewerId: { in: interviewerIds } },
          select: {
            interviewer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return overlapping.flatMap((interview) =>
      interview.panel.map((member) => ({
        interviewerId: member.interviewer.id,
        interviewerName: `${member.interviewer.firstName} ${member.interviewer.lastName}`,
        conflictingInterview: interview.interviewCode,
        from: interview.scheduledStart,
        to: interview.scheduledEnd,
      })),
    );
  }

  private async notifyPanel(
    interviewId: string,
    interviewerIds: string[],
    jobTitle: string,
    start: Date,
  ) {
    await this.notifications.notifyMany(interviewerIds, {
      title: 'You have been added to an interview panel',
      body: `Interview for "${jobTitle}" on ${start.toUTCString()}.`,
      link: `/interviews/${interviewId}`,
      category: 'INTERVIEW',
    });

    const interviewers = await this.prisma.user.findMany({
      where: { id: { in: interviewerIds } },
      select: { email: true, firstName: true },
    });

    for (const interviewer of interviewers) {
      await this.notifications.queueTemplate('interview.panel_invite', interviewer.email, {
        firstName: interviewer.firstName,
        jobTitle,
        scheduledAt: start.toISOString(),
      });
    }
  }

  async reschedule(id: string, dto: RescheduleDto, user: AuthenticatedUser, ip: string) {
    const existing = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        panel: { select: { interviewerId: true } },
        job: { select: { title: true } },
        candidate: { select: { user: { select: { email: true, firstName: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Interview not found');

    if (([InterviewStatus.COMPLETED, InterviewStatus.CANCELLED] as InterviewStatus[]).includes(existing.status)) {
      throw new BadRequestException(
        `A ${existing.status.toLowerCase()} interview cannot be rescheduled`,
      );
    }

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (end <= start) throw new BadRequestException('The interview must end after it starts');

    const interviewerIds = existing.panel.map((member) => member.interviewerId);
    const conflicts = await this.findConflicts(interviewerIds, start, end);

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        scheduledStart: start,
        scheduledEnd: end,
        status: InterviewStatus.RESCHEDULED,
        ...(dto.meetingLink !== undefined ? { meetingLink: dto.meetingLink } : {}),
        ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
      },
    });

    await this.notifications.queueTemplate(
      'interview.rescheduled',
      existing.candidate.user.email,
      {
        firstName: existing.candidate.user.firstName,
        jobTitle: existing.job.title,
        scheduledAt: start.toISOString(),
      },
    );

    await this.notifications.notifyMany(interviewerIds, {
      title: 'Interview rescheduled',
      body: `${existing.interviewCode} moved to ${start.toUTCString()}.`,
      link: `/interviews/${id}`,
      category: 'INTERVIEW',
    });

    await this.audit.log({
      action: 'INTERVIEW_RESCHEDULED',
      actorUserId: user.userId,
      entityType: 'Interview',
      entityId: id,
      metadata: { from: existing.scheduledStart, to: start, reason: dto.reason },
      ipAddress: ip,
    });

    return { ...updated, conflicts };
  }

  async cancel(id: string, reason: string, user: AuthenticatedUser, ip: string) {
    const existing = await this.prisma.interview.findUnique({
      where: { id },
      include: { panel: { select: { interviewerId: true } } },
    });
    if (!existing) throw new NotFoundException('Interview not found');
    if (existing.status === InterviewStatus.CANCELLED) {
      throw new BadRequestException('This interview is already cancelled');
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.CANCELLED, cancelReason: reason },
    });

    await this.notifications.notifyMany(
      existing.panel.map((member) => member.interviewerId),
      {
        title: 'Interview cancelled',
        body: `${existing.interviewCode} was cancelled. ${reason}`,
        link: `/interviews/${id}`,
        category: 'INTERVIEW',
      },
    );

    await this.audit.log({
      action: 'INTERVIEW_CANCELLED',
      actorUserId: user.userId,
      entityType: 'Interview',
      entityId: id,
      metadata: { reason },
      ipAddress: ip,
    });

    return updated;
  }

  async markCompleted(id: string, user: AuthenticatedUser) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) throw new NotFoundException('Interview not found');

    return this.prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.COMPLETED },
    });
  }

  // ===================================================================
  //  Read
  // ===================================================================

  async findAll(query: InterviewQueryDto, user: AuthenticatedUser) {
    const where: Prisma.InterviewWhereInput = {};

    if (query.applicationId) where.applicationId = query.applicationId;
    if (query.jobId) where.jobId = query.jobId;
    if (query.candidateId) where.candidateId = query.candidateId;
    if (query.status?.length) where.status = { in: query.status };
    if (query.from || query.to) {
      where.scheduledStart = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    // --- Visibility scoping ---
    if (!user.permissions.includes(PERMISSIONS.INTERVIEW_READ_ANY)) {
      if (user.candidateId && user.permissions.includes(PERMISSIONS.INTERVIEW_READ_OWN)) {
        where.candidateId = user.candidateId;
      } else if (user.permissions.includes(PERMISSIONS.INTERVIEW_READ_ASSIGNED)) {
        where.OR = [
          { organiserId: user.userId },
          { panel: { some: { interviewerId: user.userId } } },
          { job: { recruiterId: user.userId } },
          { job: { hiringManagerId: user.userId } },
        ];
      } else {
        throw new ForbiddenException('You do not have access to interviews');
      }
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where,
        orderBy: { scheduledStart: query.sortDir === 'asc' ? 'asc' : 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          candidate: { select: { id: true, candidateCode: true, fullName: true } },
          job: { select: { id: true, title: true, requirementCode: true } },
          application: { select: { id: true, applicationCode: true, currentStage: true } },
          panel: {
            include: {
              interviewer: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          _count: { select: { feedback: true } },
        },
      }),
      this.prisma.interview.count({ where }),
    ]);

    const isCandidateView =
      !user.permissions.includes(PERMISSIONS.INTERVIEW_READ_ANY) &&
      !user.permissions.includes(PERMISSIONS.INTERVIEW_READ_ASSIGNED);

    const data = rows.map((row) => ({
      ...row,
      // Candidates must not see who is on the panel or how many people
      // have already filed feedback.
      panel: isCandidateView ? undefined : row.panel,
      _count: isCandidateView ? undefined : row._count,
    }));

    return buildPage(data, total, query);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        candidate: {
          select: {
            id: true,
            candidateCode: true,
            fullName: true,
            totalExperience: true,
            currentDesignation: true,
          },
        },
        job: { select: { id: true, title: true, requirementCode: true } },
        application: { select: { id: true, applicationCode: true, currentStage: true } },
        organiser: { select: { id: true, firstName: true, lastName: true } },
        panel: {
          include: {
            interviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    await this.assertCanView(interview, user);
    return interview;
  }

  private async assertCanView(
    interview: { candidateId: string; organiserId: string; jobId: string; id: string },
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.permissions.includes(PERMISSIONS.INTERVIEW_READ_ANY)) return;
    if (user.candidateId === interview.candidateId) return;
    if (interview.organiserId === user.userId) return;

    const onPanel = await this.prisma.interviewPanelMember.findFirst({
      where: { interviewId: interview.id, interviewerId: user.userId },
      select: { interviewerId: true },
    });
    if (onPanel) return;

    const job = await this.prisma.jobRequirement.findUnique({
      where: { id: interview.jobId },
      select: { recruiterId: true, hiringManagerId: true },
    });
    if (job?.recruiterId === user.userId || job?.hiringManagerId === user.userId) return;

    throw new ForbiddenException('You do not have access to this interview');
  }

  /** Calendar view for a date range. */
  async calendar(from: string, to: string, user: AuthenticatedUser) {
    const query = {
      from,
      to,
      page: 1,
      pageSize: 100,
      skip: 0,
      take: 500,
      sortDir: 'asc',
    } as unknown as InterviewQueryDto;

    const page = await this.findAll(query, user);
    return (page.data as Array<Record<string, any>>).map((row) => ({
      id: row.id,
      title: `${row.candidate?.fullName ?? 'Candidate'} - ${row.roundName}`,
      start: row.scheduledStart,
      end: row.scheduledEnd,
      status: row.status,
      type: row.interviewType,
      jobTitle: row.job?.title,
      applicationId: row.application?.id,
    }));
  }

  // ===================================================================
  //  Feedback / evaluation
  // ===================================================================

  /**
   * Submits structured feedback.
   * Only a panel member may file feedback, and only for their own slot;
   * the unique (interviewId, interviewerId) index enforces one per person.
   */
  async submitFeedback(
    interviewId: string,
    dto: FeedbackDto,
    user: AuthenticatedUser,
    ip: string,
  ) {
    const membership = await this.prisma.interviewPanelMember.findUnique({
      where: {
        interviewId_interviewerId: { interviewId, interviewerId: user.userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Only assigned panel members can submit feedback');
    }

    const feedback = await this.prisma.interviewFeedback.upsert({
      where: {
        interviewId_interviewerId: { interviewId, interviewerId: user.userId },
      },
      create: {
        interviewId,
        interviewerId: user.userId,
        technicalSkills: dto.technicalSkills,
        communication: dto.communication,
        problemSolving: dto.problemSolving,
        relevantExperience: dto.relevantExperience,
        roleSuitability: dto.roleSuitability,
        teamCollaboration: dto.teamCollaboration,
        overallRating: dto.overallRating,
        strengths: dto.strengths,
        areasForImprovement: dto.areasForImprovement,
        comments: dto.comments,
        recommendation: dto.recommendation,
      },
      update: {
        technicalSkills: dto.technicalSkills,
        communication: dto.communication,
        problemSolving: dto.problemSolving,
        relevantExperience: dto.relevantExperience,
        roleSuitability: dto.roleSuitability,
        teamCollaboration: dto.teamCollaboration,
        overallRating: dto.overallRating,
        strengths: dto.strengths,
        areasForImprovement: dto.areasForImprovement,
        comments: dto.comments,
        recommendation: dto.recommendation,
      },
    });

    // Once every panel member has reported, close the interview out.
    const [panelSize, feedbackCount] = await this.prisma.$transaction([
      this.prisma.interviewPanelMember.count({ where: { interviewId } }),
      this.prisma.interviewFeedback.count({ where: { interviewId } }),
    ]);

    if (feedbackCount >= panelSize) {
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { status: InterviewStatus.COMPLETED },
      });
    }

    await this.audit.log({
      action: AUDIT_ACTIONS.FEEDBACK_SUBMITTED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'InterviewFeedback',
      entityId: feedback.id,
      metadata: { interviewId, recommendation: dto.recommendation },
      ipAddress: ip,
    });

    return feedback;
  }

  /**
   * Interview feedback is internal.
   * Candidates are never permitted to read it, whatever ids they supply.
   */
  async listFeedback(interviewId: string, user: AuthenticatedUser) {
    const canReadAll = user.permissions.includes(PERMISSIONS.FEEDBACK_READ_ANY);
    const isPanelMember = await this.prisma.interviewPanelMember.findUnique({
      where: {
        interviewId_interviewerId: { interviewId, interviewerId: user.userId },
      },
    });

    if (!canReadAll && !isPanelMember) {
      await this.audit.log({
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
        actorUserId: user.userId,
        actorEmail: user.email,
        entityType: 'InterviewFeedback',
        entityId: interviewId,
        severity: 'WARN',
      });
      throw new ForbiddenException('You do not have access to this interview feedback');
    }

    const rows = await this.prisma.interviewFeedback.findMany({
      // A panel member sees only their own submission unless they also
      // hold the read-any permission.
      where: {
        interviewId,
        ...(canReadAll ? {} : { interviewerId: user.userId }),
      },
      include: {
        interviewer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const ratings = rows.map((row) => row.overallRating);
    return {
      feedback: rows,
      summary: {
        count: rows.length,
        averageRating:
          ratings.length > 0
            ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
            : null,
        recommendations: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.recommendation] = (acc[row.recommendation] ?? 0) + 1;
          return acc;
        }, {}),
      },
    };
  }

  /** Interviews assigned to the current user that still need feedback. */
  async myPendingFeedback(user: AuthenticatedUser) {
    return this.prisma.interview.findMany({
      where: {
        panel: { some: { interviewerId: user.userId } },
        status: { in: [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED] },
        scheduledEnd: { lt: new Date() },
        feedback: { none: { interviewerId: user.userId } },
      },
      include: {
        candidate: { select: { fullName: true, candidateCode: true } },
        job: { select: { title: true, requirementCode: true } },
      },
      orderBy: { scheduledStart: 'desc' },
    });
  }
}
