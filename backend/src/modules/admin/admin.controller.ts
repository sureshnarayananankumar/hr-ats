import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { RoleName, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class CreateUserDto {
  @ApiProperty() @IsEmail() @MaxLength(255) email!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) @Transform(trim) firstName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) @Transform(trim) lastName!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(30) @IsOptional() phone?: string;

  @ApiProperty({ enum: RoleName, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RoleName, { each: true })
  roles!: RoleName[];

  @ApiProperty({ minLength: 12, description: 'Temporary password; the user must change it' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword!: string;
}

class SetRolesDto {
  @ApiProperty({ enum: RoleName, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RoleName, { each: true })
  roles!: RoleName[];
}

class SetStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

class CreateDepartmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20) @Transform(trim) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(150) @Transform(trim) name!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(500) @IsOptional() description?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() headUserId?: string;
}

class UpdateDepartmentDto {
  @ApiPropertyOptional() @IsString() @MaxLength(150) @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(500) @IsOptional() description?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() headUserId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

class CreateSourceDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) @Transform(trim) name!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(60) @IsOptional() category?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() costPerMonth?: number;
}

class UpdateSettingDto {
  @ApiProperty() @IsString() @MaxLength(5000) value!: string;
}

@ApiTags('Administration')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  // ---- Users ----

  @Get('users')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List users' })
  listUsers(@Query() query: PaginationQueryDto & { role?: RoleName; status?: UserStatus }) {
    return this.admin.listUsers(query);
  }

  @Get('users/assignable')
  @ApiOperation({ summary: 'Active users for assignment dropdowns' })
  assignable(@Query('role') role?: RoleName) {
    return this.admin.assignableUsers(role);
  }

  @Post('users')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Create a staff user account' })
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.admin.createUser(dto, user, req.ip ?? 'unknown');
  }

  @Patch('users/:id/roles')
  @RequirePermissions(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({ summary: 'Replace a user roles (revokes their sessions)' })
  setRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.admin.setUserRoles(id, dto.roles, user, req.ip ?? 'unknown');
  }

  @Patch('users/:id/status')
  @RequirePermissions(PERMISSIONS.USER_DEACTIVATE)
  @ApiOperation({ summary: 'Activate, suspend or deactivate a user' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.admin.setUserStatus(id, dto.status, user, req.ip ?? 'unknown');
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Roles with their permission bundles' })
  listRoles() {
    return this.admin.listRoles();
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({ summary: 'The full permission catalogue' })
  listPermissions() {
    return this.admin.listPermissions();
  }

  // ---- Departments ----

  @Get('departments')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: 'List departments' })
  listDepartments(@Query('includeInactive') includeInactive?: string) {
    return this.admin.listDepartments(includeInactive === 'true');
  }

  @Post('departments')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  @ApiOperation({ summary: 'Create a department' })
  createDepartment(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createDepartment(dto, user);
  }

  @Patch('departments/:id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  @ApiOperation({ summary: 'Update a department' })
  updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.admin.updateDepartment(id, dto);
  }

  // ---- Recruitment sources ----

  @Get('sources')
  @ApiOperation({ summary: 'List recruitment sources' })
  listSources() {
    return this.admin.listSources();
  }

  @Post('sources')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Create a recruitment source' })
  createSource(@Body() dto: CreateSourceDto) {
    return this.admin.createSource(dto);
  }

  // ---- Settings ----

  @Get('settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'System settings (secret values are masked)' })
  listSettings() {
    return this.admin.listSettings();
  }

  @Patch('settings/:key')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Update a system setting' })
  updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.admin.updateSetting(key, dto.value, user, req.ip ?? 'unknown');
  }

  // ---- Audit logs ----

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Search the audit trail' })
  auditLogs(
    @Query()
    query: PaginationQueryDto & {
      action?: string;
      actorUserId?: string;
      entityType?: string;
      severity?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    return this.audit.findAll(query);
  }

  @Get('security-summary')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Security event counts for the last N days' })
  securitySummary(@Query('days') days?: string) {
    const window = Math.min(Math.max(Number.parseInt(days ?? '7', 10) || 7, 1), 90);
    return this.audit.securitySummary(new Date(Date.now() - window * 86_400_000));
  }
}
