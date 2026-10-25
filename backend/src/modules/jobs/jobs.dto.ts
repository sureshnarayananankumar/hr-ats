import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmploymentType, JobStatus, Priority, WorkMode } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Comma-separated query params arrive as a string; normalise to array. */
const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  return value;
};

export class JobSkillDto {
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  name!: string;

  @ApiPropertyOptional({ default: true, description: 'false marks it as preferred' })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  minYears?: number;
}

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  description!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  responsibilities?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  qualifications?: string;

  @ApiPropertyOptional({ description: 'Never shown on the public careers portal' })
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  internalNotes?: string;

  @ApiProperty()
  @IsUUID()
  departmentId!: string;

  @ApiProperty({ example: 'Senior Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(trim)
  designation!: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  @IsOptional()
  vacancies?: number;

  @ApiPropertyOptional({ default: 0 })
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
  @Max(50)
  @IsOptional()
  maxExperience?: number;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiProperty({ enum: WorkMode })
  @IsEnum(WorkMode)
  workMode!: WorkMode;

  @ApiProperty({ example: 'Muscat, Oman' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  location!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @ApiPropertyOptional({ default: 'USD', maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  salaryCurrency?: string;

  @ApiPropertyOptional({ default: true, description: 'Hide salary on the public portal' })
  @IsBoolean()
  @IsOptional()
  salaryConfidential?: boolean;

  @ApiProperty({ enum: Priority })
  @IsEnum(Priority)
  priority!: Priority;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  applicationDeadline?: string;

  @ApiPropertyOptional({ description: 'Defaults to the caller' })
  @IsUUID()
  @IsOptional()
  requestedById?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  recruiterId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  hiringManagerId?: string;

  @ApiPropertyOptional({ type: [JobSkillDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => JobSkillDto)
  @IsOptional()
  skills?: JobSkillDto[];
}

/**
 * Update deliberately omits status, vacanciesFilled, requirementCode and
 * slug: those change only through the dedicated workflow endpoints, so
 * they cannot be mass-assigned through a plain PATCH.
 */
export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class JobQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: JobStatus, isArray: true })
  @Transform(toArray)
  @IsEnum(JobStatus, { each: true })
  @IsOptional()
  status?: JobStatus[];

  @ApiPropertyOptional({ enum: Priority, isArray: true })
  @Transform(toArray)
  @IsEnum(Priority, { each: true })
  @IsOptional()
  priority?: Priority[];

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
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  recruiterId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  hiringManagerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  createdTo?: string;
}

export class ChangeJobStatusDto {
  @ApiProperty({ enum: JobStatus })
  @IsEnum(JobStatus)
  status!: JobStatus;

  @ApiPropertyOptional({ description: 'Required for ON_HOLD and CANCELLED' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  reason?: string;
}

export class SubmitForApprovalDto {
  @ApiProperty({ type: [String], description: 'User IDs who must approve' })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  approverIds!: string[];
}

export class ApprovalDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'] as unknown as object)
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  @Transform(trim)
  comments?: string;
}

export class AssignRecruiterDto {
  @ApiProperty()
  @IsUUID()
  recruiterId!: string;
}
