import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

/** Output formats supported by the /export endpoints. */
export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Shared pagination / sorting / search query parameters.
 *
 * `sortBy` is validated against an allow-list by each service before it
 * reaches Prisma, so it can never be used to probe arbitrary columns.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;

  @ApiPropertyOptional({ description: 'Free-text search term' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ description: 'Column to sort by (allow-listed per endpoint)' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.DESC })
  @IsEnum(SortDirection)
  @IsOptional()
  sortDir: SortDirection = SortDirection.DESC;

  /**
   * Output format for the matching /export endpoints.
   *
   * Declared on the shared base because global validation runs with
   * `forbidNonWhitelisted`, so an undeclared query parameter is rejected
   * outright -- an export route reached with ?format=xlsx would 400.
   */
  @ApiPropertyOptional({ enum: ExportFormat, default: ExportFormat.CSV })
  @IsEnum(ExportFormat)
  @IsOptional()
  format: ExportFormat = ExportFormat.CSV;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}

export class PageMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalItems!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() hasPreviousPage!: boolean;
}

export class PaginatedDto<T> {
  data!: T[];
  meta!: PageMetaDto;
}

export function buildPage<T>(
  data: T[],
  totalItems: number,
  query: { page: number; pageSize: number },
): PaginatedDto<T> {
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    },
  };
}

/**
 * Guards `sortBy` against an explicit allow-list.
 * Anything unexpected silently falls back to the default column rather
 * than reaching the query builder.
 */
export function safeSort(
  sortBy: string | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  return sortBy && allowed.includes(sortBy) ? sortBy : fallback;
}
