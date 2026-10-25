import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { EmailStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

class UpdateTemplateDto {
  @ApiPropertyOptional() @IsString() @MaxLength(300) @IsOptional() subject?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(50000) @IsOptional() bodyHtml?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(50000) @IsOptional() bodyText?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ_OWN)
  @ApiOperation({ summary: 'Your in-app notifications' })
  list(
    @Query() query: PaginationQueryDto,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Always scoped to the caller's own user id from the token.
    return this.notifications.listForUser(user.userId, query, unreadOnly === 'true');
  }

  @Get('unread-count')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ_OWN)
  @ApiOperation({ summary: 'Unread notification count (for the bell badge)' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @Patch(':id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ_OWN)
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user.userId);
  }

  @Patch('read-all')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ_OWN)
  @ApiOperation({ summary: 'Mark all your notifications as read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }

  // ---- Template administration ----

  @Get('templates')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'Email / notification templates' })
  listTemplates() {
    return this.notifications.listTemplates();
  }

  @Patch('templates/:id')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'Edit a notification template' })
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.notifications.updateTemplate(id, dto);
  }

  @Get('email-logs')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'Email delivery log' })
  emailLogs(@Query() query: PaginationQueryDto, @Query('status') status?: EmailStatus) {
    return this.notifications.listEmailLogs(query, status);
  }
}
