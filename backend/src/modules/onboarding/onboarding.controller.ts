import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import {
  CreateTaskDto,
  OnboardingQueryDto,
  UpdateOnboardingDto,
  UpdateTaskDto,
} from './onboarding.dto';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List onboarding records' })
  findAll(@Query() query: OnboardingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.findAll(query, user);
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'Onboarding tasks assigned to you' })
  myTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.myTasks(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one onboarding record with its checklist' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.findOne(id, user);
  }

  @Post(':id/initialise-tasks')
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: 'Seed the default onboarding checklist' })
  initialise(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.initialiseTasks(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({
    summary: 'Update an onboarding record',
    description:
      'Setting status to JOINED is the only action that marks the ' +
      'application as hired, and it requires every mandatory task to be done.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOnboardingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.onboarding.update(id, dto, user, req.ip ?? 'unknown');
  }

  @Post(':id/tasks')
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: 'Add an onboarding task' })
  addTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboarding.addTask(id, dto, user);
  }

  @Patch('tasks/:taskId')
  @RequirePermissions(PERMISSIONS.ONBOARDING_TASK_UPDATE)
  @ApiOperation({ summary: 'Update an onboarding task' })
  updateTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboarding.updateTask(taskId, dto, user);
  }

  @Delete('tasks/:taskId')
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ApiOperation({ summary: 'Remove an onboarding task' })
  removeTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.onboarding.removeTask(taskId);
  }
}
