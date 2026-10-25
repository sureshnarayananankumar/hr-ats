import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InterviewStatus, InterviewType, Recommendation } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return value;
};

export class ScheduleInterviewDto {
  @ApiProperty()
  @IsUUID()
  applicationId!: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  round?: number;

  @ApiProperty({ example: 'Technical Round 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  roundName!: string;

  @ApiProperty({ enum: InterviewType })
  @IsEnum(InterviewType)
  interviewType!: InterviewType;

  @ApiProperty({ example: '2026-11-02T09:00:00.000Z' })
  @IsDateString()
  scheduledStart!: string;

  @ApiProperty({ example: '2026-11-02T10:00:00.000Z' })
  @IsDateString()
  scheduledEnd!: string;

  @ApiPropertyOptional({ default: 'UTC', example: 'Asia/Muscat' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  timeZone?: string;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  @IsOptional()
  meetingLink?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  @Transform(trim)
  venue?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  instructions?: string;

  @ApiProperty({ type: [String], description: 'Panel member user IDs; the first is the lead' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  interviewerIds!: string[];
}

export class RescheduleDto {
  @ApiProperty()
  @IsDateString()
  scheduledStart!: string;

  @ApiProperty()
  @IsDateString()
  scheduledEnd!: string;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  @IsOptional()
  meetingLink?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  venue?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  reason?: string;
}

export class CancelInterviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(trim)
  reason!: string;
}

/** Structured evaluation form. Criteria are scored 1-5. */
export class FeedbackDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  technicalSkills?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  communication?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  problemSolving?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  relevantExperience?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  roleSuitability?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  teamCollaboration?: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  strengths?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  areasForImprovement?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  comments?: string;

  @ApiProperty({ enum: Recommendation })
  @IsEnum(Recommendation)
  recommendation!: Recommendation;
}

export class InterviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  applicationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  jobId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  candidateId?: string;

  @ApiPropertyOptional({ enum: InterviewStatus, isArray: true })
  @Transform(toArray)
  @IsEnum(InterviewStatus, { each: true })
  @IsOptional()
  status?: InterviewStatus[];

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to?: string;
}
