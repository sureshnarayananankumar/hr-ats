import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PUBLIC_THROTTLE } from '../../common/auth/throttle.config';
import { EmploymentType, JobStatus, Prisma, WorkMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/auth/decorators';
import { PaginationQueryDto, buildPage } from '../../common/dto/pagination.dto';

const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return value;
};

class PublicJobQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  department?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  skill?: string;

  @ApiPropertyOptional({ enum: EmploymentType, isArray: true })
  @Transform(toArray)
  @IsEnum(EmploymentType, { each: true })
  @IsOptional()
  employmentType?: EmploymentType[];

  @ApiPropertyOptional({ enum: WorkMode, isArray: true })
  @Transform(toArray)
  @IsEnum(WorkMode, { each: true })
  @IsOptional()
  workMode?: WorkMode[];

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  minExperience?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  salaryFrom?: number;
}

/**
 * The public careers portal.
 *
 * Every route here is unauthenticated, so the selection is deliberately
 * narrow: only PUBLISHED jobs are visible, and internal fields
 * (internalNotes, recruiter identity, applicant counts, approvals) are
 * never selected. Compensation appears only when the requirement is not
 * marked confidential.
 */
@ApiTags('Public Careers Portal')
@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  /** The only job filter that may ever be used on a public route. */
  private get liveJobFilter(): Prisma.JobRequirementWhereInput {
    return {
      status: JobStatus.PUBLISHED,
      OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }],
    };
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Get('jobs')
  @ApiOperation({ summary: 'Browse published job openings' })
  async listJobs(@Query() query: PublicJobQueryDto) {
    const where: Prisma.JobRequirementWhereInput = { ...this.liveJobFilter };
    const and: Prisma.JobRequirementWhereInput[] = [];

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search } },
          { designation: { contains: query.search } },
          { location: { contains: query.search } },
          { skills: { some: { skill: { name: { contains: query.search } } } } },
        ],
      });
    }
    if (query.location) and.push({ location: { contains: query.location } });
    if (query.department) and.push({ department: { name: { contains: query.department } } });
    if (query.skill) {
      and.push({ skills: { some: { skill: { name: { contains: query.skill } } } } });
    }
    if (query.employmentType?.length) and.push({ employmentType: { in: query.employmentType } });
    if (query.workMode?.length) and.push({ workMode: { in: query.workMode } });
    if (query.minExperience != null) and.push({ minExperience: { lte: query.minExperience } });
    if (query.salaryFrom != null) and.push({ salaryMax: { gte: query.salaryFrom } });

    if (and.length > 0) where.AND = and;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobRequirement.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          slug: true,
          requirementCode: true,
          title: true,
          designation: true,
          location: true,
          employmentType: true,
          workMode: true,
          minExperience: true,
          maxExperience: true,
          vacancies: true,
          publishedAt: true,
          applicationDeadline: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryConfidential: true,
          department: { select: { name: true } },
          skills: {
            where: { isRequired: true },
            select: { skill: { select: { name: true } } },
            take: 8,
          },
        },
      }),
      this.prisma.jobRequirement.count({ where }),
    ]);

    return buildPage(rows.map((row) => this.toPublicJob(row)), total, query);
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Get('jobs/:slug')
  @ApiOperation({ summary: 'Job detail page by its public slug' })
  async jobBySlug(@Param('slug') slug: string) {
    const job = await this.prisma.jobRequirement.findFirst({
      // The live filter is applied here too, so a closed job cannot be
      // reached by guessing its slug.
      where: { slug, status: JobStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        requirementCode: true,
        title: true,
        description: true,
        responsibilities: true,
        qualifications: true,
        designation: true,
        location: true,
        employmentType: true,
        workMode: true,
        minExperience: true,
        maxExperience: true,
        vacancies: true,
        publishedAt: true,
        applicationDeadline: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryConfidential: true,
        departmentId: true,
        department: { select: { name: true } },
        skills: { select: { skill: { select: { name: true } }, isRequired: true, minYears: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('This job is no longer available');
    }

    const isExpired = Boolean(job.applicationDeadline && job.applicationDeadline < new Date());

    const related = await this.prisma.jobRequirement.findMany({
      where: {
        ...this.liveJobFilter,
        departmentId: job.departmentId,
        id: { not: job.id },
      },
      take: 4,
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        location: true,
        employmentType: true,
        workMode: true,
      },
    });

    return {
      ...this.toPublicJob(job),
      description: job.description,
      responsibilities: job.responsibilities,
      qualifications: job.qualifications,
      requiredSkills: job.skills.filter((s) => s.isRequired).map((s) => s.skill.name),
      preferredSkills: job.skills.filter((s) => !s.isRequired).map((s) => s.skill.name),
      // Deadline passed: still readable, but clearly not applicable.
      acceptingApplications: !isExpired,
      isExpired,
      related,
      departmentId: undefined,
    };
  }

  @Public()
  @Get('departments')
  @ApiOperation({ summary: 'Departments that currently have published openings' })
  async departments() {
    const rows = await this.prisma.department.findMany({
      where: { isActive: true, jobRequirements: { some: this.liveJobFilter } },
      select: {
        id: true,
        name: true,
        _count: { select: { jobRequirements: { where: this.liveJobFilter } } },
      },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      openPositions: row._count.jobRequirements,
    }));
  }

  @Public()
  @Get('locations')
  @ApiOperation({ summary: 'Locations that currently have published openings' })
  async locations() {
    const rows = await this.prisma.jobRequirement.groupBy({
      by: ['location'],
      where: this.liveJobFilter,
      _count: { _all: true },
      orderBy: { _count: { location: 'desc' } },
      take: 50,
    });

    return rows.map((row) => ({ location: row.location, openPositions: row._count._all }));
  }

  @Public()
  @Get('sources')
  @ApiOperation({ summary: 'Recruitment sources offered on the application form' })
  sources() {
    return this.prisma.recruitmentSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Strips confidential compensation before anything leaves the server. */
  private toPublicJob(job: Record<string, any>) {
    const showSalary = job.salaryConfidential === false;
    return {
      id: job.id,
      slug: job.slug,
      requirementCode: job.requirementCode,
      title: job.title,
      designation: job.designation,
      department: job.department?.name ?? null,
      location: job.location,
      employmentType: job.employmentType,
      workMode: job.workMode,
      minExperience: job.minExperience,
      maxExperience: job.maxExperience,
      vacancies: job.vacancies,
      publishedAt: job.publishedAt,
      applicationDeadline: job.applicationDeadline,
      salaryMin: showSalary ? job.salaryMin : null,
      salaryMax: showSalary ? job.salaryMax : null,
      salaryCurrency: showSalary ? job.salaryCurrency : null,
      salaryDisclosed: showSalary,
      skills: job.skills?.map((entry: any) => entry.skill.name) ?? [],
    };
  }
}
