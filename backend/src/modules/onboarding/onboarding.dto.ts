import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { OnboardingStatus, TaskStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return value;
};

export class UpdateOnboardingDto {
  @ApiPropertyOptional({ enum: OnboardingStatus })
  @IsEnum(OnboardingStatus)
  @IsOptional()
  status?: OnboardingStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  actualJoinDate?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  @Transform(trim)
  designation?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  reportingManagerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(30)
  @IsOptional()
  @Transform(trim)
  employeeCode?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  documentsVerified?: boolean;

  @ApiPropertyOptional({ description: 'Required when status is DID_NOT_JOIN' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  didNotJoinReason?: string;
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'DOCUMENTATION' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ownerUserId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(trim)
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ownerUserId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}

export class OnboardingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OnboardingStatus, isArray: true })
  @Transform(toArray)
  @IsEnum(OnboardingStatus, { each: true })
  @IsOptional()
  status?: OnboardingStatus[];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  joiningFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  joiningTo?: string;
}
