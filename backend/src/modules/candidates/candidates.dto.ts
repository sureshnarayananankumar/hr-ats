import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmploymentType, SkillProficiency, WorkMode } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return value;
};

export class CandidateSkillDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  name!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  @IsOptional()
  years?: number;

  @ApiPropertyOptional({ enum: SkillProficiency })
  @IsEnum(SkillProficiency)
  @IsOptional()
  proficiency?: SkillProficiency;
}

export class EducationEntryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  degree!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  institution!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  grade?: string;
}

export class UpdateCandidateDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(trim)
  fullName?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(30)
  @IsOptional()
  @Transform(trim)
  mobile?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(trim)
  location?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(60)
  @IsOptional()
  totalExperience?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  @Transform(trim)
  currentDesignation?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(trim)
  currentCompany?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(trim)
  highestEducation?: string;

  @ApiPropertyOptional({ type: [EducationEntryDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EducationEntryDto)
  @IsOptional()
  educationDetails?: EducationEntryDto[];

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  expectedSalary?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  currentSalary?: number;

  @ApiPropertyOptional({ maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  salaryCurrency?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  noticePeriodDays?: number;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(400)
  @IsOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(400)
  @IsOptional()
  portfolioUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(trim)
  preferredLocation?: string;

  @ApiPropertyOptional({ enum: WorkMode })
  @IsEnum(WorkMode)
  @IsOptional()
  preferredWorkMode?: WorkMode;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  @IsOptional()
  preferredEmploymentType?: EmploymentType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  willingToRelocate?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({ type: [CandidateSkillDto] })
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CandidateSkillDto)
  @IsOptional()
  skills?: CandidateSkillDto[];
}

export class CandidateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minExperience?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxExperience?: number;

  @ApiPropertyOptional({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  @IsOptional()
  tagIds?: string[];
}

export class CandidateNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}

export class CandidateTagDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Transform(trim)
  name!: string;
}
