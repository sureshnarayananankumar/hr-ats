import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { OfferStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((e) => e.trim()).filter(Boolean);
  return value;
};

export class CreateOfferDto {
  @ApiProperty()
  @IsUUID()
  applicationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(trim)
  proposedDesignation!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  @Transform(trim)
  departmentName?: string;

  @ApiProperty({ description: 'Annual gross compensation' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualSalary!: number;

  @ApiPropertyOptional({ default: 'USD', maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  bonus?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  benefits?: string;

  @ApiProperty()
  @IsDateString()
  joiningDate!: string;

  @ApiPropertyOptional({ description: 'Must not be after the joining date' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateOfferDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  @Transform(trim)
  proposedDesignation?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  departmentName?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  annualSalary?: number;

  @ApiPropertyOptional({ maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  bonus?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  benefits?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class SubmitOfferApprovalDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  approverIds!: string[];
}

export class OfferApprovalDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'] as unknown as object)
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  comments?: string;
}

export class RespondToOfferDto {
  @ApiProperty({ description: 'true to accept, false to decline' })
  @IsBoolean()
  accept!: boolean;

  @ApiPropertyOptional({ description: 'Required when declining' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trim)
  declineReason?: string;
}

export class WithdrawOfferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(trim)
  reason!: string;
}

export class OfferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OfferStatus, isArray: true })
  @Transform(toArray)
  @IsEnum(OfferStatus, { each: true })
  @IsOptional()
  status?: OfferStatus[];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  jobId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  candidateId?: string;
}
