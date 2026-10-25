import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApplicationStage, ApplicationStatus, ScreeningResult } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return value;
};

const toBool = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

export class CreateApplicationDto {
  @ApiProperty()
  @IsUUID()
  jobId!: string;

  @ApiPropertyOptional({ description: 'Must be a document owned by the applying candidate' })
  @IsUUID()
  @IsOptional()
  resumeDocumentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  coverLetter?: string;

  @ApiPropertyOptional({ description: 'Recruitment source' })
  @IsUUID()
  @IsOptional()
  sourceId?: string;
}

export class TransitionDto {
  @ApiPropertyOptional({ enum: ApplicationStage })
  @IsEnum(ApplicationStage)
  @IsOptional()
  toStage?: ApplicationStage;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  @IsOptional()
  toStatus?: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  reason?: string;

  @ApiPropertyOptional({ enum: ScreeningResult })
  @IsEnum(ScreeningResult)
  @IsOptional()
  screeningResult?: ScreeningResult;

  @ApiPropertyOptional({ description: 'Internal only; never shown to the candidate' })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  screeningRemarks?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  notifyCandidate?: boolean;
}

export class BulkTransitionDto {
  @ApiProperty({ type: [String], maxItems: 200 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  applicationIds!: string[];

  @ApiPropertyOptional({ enum: ApplicationStage })
  @IsEnum(ApplicationStage)
  @IsOptional()
  toStage?: ApplicationStage;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  @IsOptional()
  toStatus?: ApplicationStatus;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  reason?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  notifyCandidate?: boolean;
}

export class WithdrawDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  reason?: string;
}

export class AddNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ default: true, description: 'Internal notes are hidden from candidates' })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}

export class AssignApplicationDto {
  @ApiProperty()
  @IsUUID()
  recruiterId!: string;
}

export class ApplicationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  jobId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  candidateId?: string;

  @ApiPropertyOptional({ enum: ApplicationStage, isArray: true })
  @Transform(toArray)
  @IsEnum(ApplicationStage, { each: true })
  @IsOptional()
  stage?: ApplicationStage[];

  @ApiPropertyOptional({ enum: ApplicationStatus, isArray: true })
  @Transform(toArray)
  @IsEnum(ApplicationStatus, { each: true })
  @IsOptional()
  status?: ApplicationStatus[];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  recruiterId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sourceId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  appliedFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  appliedTo?: string;

  @ApiPropertyOptional({ description: 'Only applications past their follow-up date' })
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  overdueOnly?: boolean;
}
