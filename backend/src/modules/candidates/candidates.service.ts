import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildPage, safeSort } from '../../common/dto/pagination.dto';
import { normalisePhone } from '../../common/utils/codes.util';
import { AUDIT_ACTIONS } from '../../common/constants';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import type { CandidateQueryDto, UpdateCandidateDto } from './candidates.dto';

const SORTABLE = ['createdAt', 'fullName', 'totalExperience', 'candidateCode'] as const;

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: CandidateQueryDto, user: AuthenticatedUser) {
    // Listing candidates requires an "any" permission by definition --
    // there is no self-scoped version of a candidate directory.
    if (!user.permissions.includes(PERMISSIONS.CANDIDATE_READ_ANY)) {
      throw new ForbiddenException('You do not have access to the candidate directory');
    }

    const where: Prisma.CandidateProfileWhereInput = {};

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search } },
        { candidateCode: { contains: query.search } },
        { normalisedEmail: { contains: query.search.toLowerCase() } },
        { currentCompany: { contains: query.search } },
        { currentDesignation: { contains: query.search } },
      ];
    }
    if (query.location) where.location = { contains: query.location };
    if (query.minExperience != null || query.maxExperience != null) {
      where.totalExperience = {
        ...(query.minExperience != null ? { gte: query.minExperience } : {}),
        ...(query.maxExperience != null ? { lte: query.maxExperience } : {}),
      };
    }
    if (query.skills?.length) {
      where.skills = { some: { skill: { name: { in: query.skills } } } };
    }
    if (query.tagIds?.length) {
      where.tags = { some: { tagId: { in: query.tagIds } } };
    }

    const sortBy = safeSort(query.sortBy, SORTABLE, 'createdAt');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.candidateProfile.findMany({
        where,
        orderBy: { [sortBy]: query.sortDir },
        skip: query.skip,
        take: query.take,
        include: {
          user: { select: { email: true, status: true, lastLoginAt: true } },
          skills: { include: { skill: { select: { name: true } } }, take: 10 },
          tags: { include: { tag: true } },
          _count: { select: { applications: true, documents: true } },
        },
      }),
      this.prisma.candidateProfile.count({ where }),
    ]);

    return buildPage(rows, total, query);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, phone: true, status: true, lastLoginAt: true },
        },
        skills: { include: { skill: true } },
        tags: { include: { tag: true } },
        applications: {
          orderBy: { appliedAt: 'desc' },
          include: { job: { select: { id: true, title: true, requirementCode: true } } },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            documentType: true,
            originalName: true,
            version: true,
            isCurrent: true,
            uploadedAt: true,
            sizeBytes: true,
          },
        },
      },
    });

    if (!candidate) throw new NotFoundException('Candidate not found');
    this.assertCanView(candidate, user);

    return candidate;
  }

  /**
   * Object-level access check.
   *
   * This is the guard that stops candidate A reading candidate B by
   * changing the id in the URL: ownership is compared against the
   * verified token, and a denial is recorded.
   */
  private assertCanView(
    candidate: { id: string; userId: string },
    user: AuthenticatedUser,
  ): void {
    if (user.permissions.includes(PERMISSIONS.CANDIDATE_READ_ANY)) return;
    if (candidate.userId === user.userId) return;

    void this.audit.log({
      action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'CandidateProfile',
      entityId: candidate.id,
      severity: 'WARN',
      metadata: { reason: 'CROSS_CANDIDATE_ACCESS_ATTEMPT' },
    });

    throw new ForbiddenException('You do not have access to this candidate profile');
  }

  /** The signed-in candidate's own profile. */
  async findMine(user: AuthenticatedUser) {
    if (!user.candidateId) throw new NotFoundException('No candidate profile for this account');
    return this.findOne(user.candidateId, user);
  }

  async update(id: string, dto: UpdateCandidateDto, user: AuthenticatedUser) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const isOwner = candidate.userId === user.userId;
    const canEditAny = user.permissions.includes(PERMISSIONS.CANDIDATE_UPDATE_ANY);
    if (!isOwner && !canEditAny) {
      throw new ForbiddenException('You cannot edit this candidate profile');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.candidateProfile.update({
        where: { id },
        data: {
          // Only whitelisted fields -- candidateCode, userId and consent
          // timestamps are deliberately not updatable here.
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.mobile !== undefined
            ? { mobile: dto.mobile, normalisedPhone: normalisePhone(dto.mobile) }
            : {}),
          ...(dto.location !== undefined ? { location: dto.location } : {}),
          ...(dto.totalExperience !== undefined ? { totalExperience: dto.totalExperience } : {}),
          ...(dto.currentDesignation !== undefined
            ? { currentDesignation: dto.currentDesignation }
            : {}),
          ...(dto.currentCompany !== undefined ? { currentCompany: dto.currentCompany } : {}),
          ...(dto.highestEducation !== undefined
            ? { highestEducation: dto.highestEducation }
            : {}),
          ...(dto.educationDetails !== undefined
            ? { educationDetails: JSON.stringify(dto.educationDetails) }
            : {}),
          ...(dto.expectedSalary !== undefined ? { expectedSalary: dto.expectedSalary } : {}),
          ...(dto.currentSalary !== undefined ? { currentSalary: dto.currentSalary } : {}),
          ...(dto.salaryCurrency !== undefined ? { salaryCurrency: dto.salaryCurrency } : {}),
          ...(dto.noticePeriodDays !== undefined
            ? { noticePeriodDays: dto.noticePeriodDays }
            : {}),
          ...(dto.linkedinUrl !== undefined ? { linkedinUrl: dto.linkedinUrl } : {}),
          ...(dto.portfolioUrl !== undefined ? { portfolioUrl: dto.portfolioUrl } : {}),
          ...(dto.preferredLocation !== undefined
            ? { preferredLocation: dto.preferredLocation }
            : {}),
          ...(dto.preferredWorkMode !== undefined
            ? { preferredWorkMode: dto.preferredWorkMode }
            : {}),
          ...(dto.preferredEmploymentType !== undefined
            ? { preferredEmploymentType: dto.preferredEmploymentType }
            : {}),
          ...(dto.willingToRelocate !== undefined
            ? { willingToRelocate: dto.willingToRelocate }
            : {}),
          ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        },
      });

      if (dto.skills) {
        await tx.candidateSkill.deleteMany({ where: { candidateId: id } });
        for (const entry of dto.skills) {
          const name = entry.name.trim();
          if (!name) continue;
          const skill = await tx.skill.upsert({
            where: { name },
            create: { name },
            update: {},
          });
          await tx.candidateSkill.create({
            data: {
              candidateId: id,
              skillId: skill.id,
              years: entry.years,
              proficiency: entry.proficiency ?? 'INTERMEDIATE',
            },
          });
        }
      }

      await tx.candidateActivity.create({
        data: {
          candidateId: id,
          activity: 'PROFILE_UPDATED',
          detail: isOwner ? 'Profile updated by candidate' : 'Profile updated by HR',
          actorUserId: user.userId,
        },
      });

      return result;
    });

    return updated;
  }

  /**
   * Flags likely duplicates by normalised email or phone.
   * Deliberately advisory: HR decides, the system does not auto-merge.
   */
  async findDuplicates(id: string, user: AuthenticatedUser) {
    if (!user.permissions.includes(PERMISSIONS.CANDIDATE_READ_ANY)) {
      throw new ForbiddenException('Missing permission: candidate.read.any');
    }

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id },
      select: { id: true, normalisedEmail: true, normalisedPhone: true, fullName: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const matches = await this.prisma.candidateProfile.findMany({
      where: {
        id: { not: id },
        OR: [
          { normalisedEmail: candidate.normalisedEmail },
          ...(candidate.normalisedPhone
            ? [{ normalisedPhone: candidate.normalisedPhone }]
            : []),
          { fullName: candidate.fullName },
        ],
      },
      select: {
        id: true,
        candidateCode: true,
        fullName: true,
        normalisedEmail: true,
        normalisedPhone: true,
        createdAt: true,
      },
      take: 25,
    });

    return matches.map((match) => ({
      ...match,
      matchedOn: [
        match.normalisedEmail === candidate.normalisedEmail ? 'email' : null,
        match.normalisedPhone && match.normalisedPhone === candidate.normalisedPhone
          ? 'phone'
          : null,
        match.fullName === candidate.fullName ? 'name' : null,
      ].filter(Boolean),
    }));
  }

  // ===================================================================
  //  Notes, tags, activity
  // ===================================================================

  async addNote(candidateId: string, body: string, user: AuthenticatedUser) {
    return this.prisma.candidateNote.create({
      data: { candidateId, authorId: user.userId, body },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async listNotes(candidateId: string, user: AuthenticatedUser) {
    // Recruiter notes are internal: a candidate never reads these, which
    // is why this requires the manage permission rather than ownership.
    if (!user.permissions.includes(PERMISSIONS.CANDIDATE_NOTE_MANAGE)) {
      throw new ForbiddenException('Missing permission: candidate.note.manage');
    }
    return this.prisma.candidateNote.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async listTags() {
    return this.prisma.candidateTag.findMany({ orderBy: { name: 'asc' } });
  }

  async addTag(candidateId: string, tagName: string, user: AuthenticatedUser) {
    const tag = await this.prisma.candidateTag.upsert({
      where: { name: tagName.trim() },
      create: { name: tagName.trim() },
      update: {},
    });

    await this.prisma.candidateTagLink.upsert({
      where: { candidateId_tagId: { candidateId, tagId: tag.id } },
      create: { candidateId, tagId: tag.id, assignedById: user.userId },
      update: {},
    });

    return tag;
  }

  async removeTag(candidateId: string, tagId: string) {
    await this.prisma.candidateTagLink.deleteMany({ where: { candidateId, tagId } });
    return { message: 'Tag removed' };
  }

  async activity(candidateId: string, user: AuthenticatedUser) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { id: true, userId: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    this.assertCanView(candidate, user);

    const rows = await this.prisma.candidateActivity.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  }

  /**
   * Candidate-initiated data-deletion request (privacy control).
   * Flagged for HR review rather than executed immediately, because
   * applications and offers carry retention obligations.
   */
  async requestDataDeletion(user: AuthenticatedUser) {
    if (!user.candidateId) throw new NotFoundException('No candidate profile');

    await this.prisma.candidateProfile.update({
      where: { id: user.candidateId },
      data: { dataDeletionRequestedAt: new Date() },
    });

    await this.audit.log({
      action: 'DATA_DELETION_REQUESTED',
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'CandidateProfile',
      entityId: user.candidateId,
      severity: 'WARN',
    });

    return {
      message:
        'Your deletion request has been recorded. HR will respond within the ' +
        'retention window described in the privacy policy.',
    };
  }

  async exportRows(query: CandidateQueryDto, user: AuthenticatedUser) {
    if (!user.permissions.includes(PERMISSIONS.CANDIDATE_EXPORT)) {
      throw new ForbiddenException('Missing permission: candidate.export');
    }

    const page = await this.findAll({ ...query, page: 1, pageSize: 100 } as CandidateQueryDto, user);
    return (page.data as Array<Record<string, any>>).map((row) => ({
      'Candidate ID': row.candidateCode,
      Name: row.fullName,
      Email: row.user?.email ?? '',
      Mobile: row.mobile ?? '',
      Location: row.location ?? '',
      Experience: row.totalExperience?.toString() ?? '',
      'Current Designation': row.currentDesignation ?? '',
      'Current Company': row.currentCompany ?? '',
      Education: row.highestEducation ?? '',
      'Notice Period (days)': row.noticePeriodDays ?? '',
      Skills: row.skills?.map((entry: any) => entry.skill.name).join('; ') ?? '',
      Tags: row.tags?.map((entry: any) => entry.tag.name).join('; ') ?? '',
      Applications: row._count?.applications ?? 0,
      'Registered At': row.createdAt?.toISOString?.() ?? '',
    }));
  }
}
