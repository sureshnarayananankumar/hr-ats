import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApplicationsService } from './applications.service';
import {
  AddNoteDto,
  ApplicationQueryDto,
  AssignApplicationDto,
  BulkTransitionDto,
  CreateApplicationDto,
  TransitionDto,
  WithdrawDto,
} from './applications.dto';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import { sendCsv, sendExcel } from '../../common/utils/export.util';

@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.APPLICATION_CREATE_OWN)
  @ApiOperation({ summary: 'Apply for a published job' })
  apply(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!user.candidateId) {
      throw new ForbiddenException('Only candidate accounts can submit applications');
    }
    // The candidate id comes from the verified token, never the body --
    // a caller cannot apply on someone else's behalf.
    return this.applications.apply(user.candidateId, dto, user, req.ip ?? 'unknown');
  }

  @Get()
  @ApiOperation({ summary: 'List applications visible to you' })
  findAll(@Query() query: ApplicationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.findAll(query, user);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.APPLICATION_EXPORT)
  @ApiOperation({ summary: 'Export applications as CSV or Excel' })
  async export(
    @Query() query: ApplicationQueryDto,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const rows = await this.applications.exportRows(query, user);
    const filename = `applications-${new Date().toISOString().slice(0, 10)}`;
    return format === 'xlsx'
      ? sendExcel(res, rows, filename, 'Applications')
      : sendCsv(res, rows, filename);
  }

  @Get('pipeline/:jobId')
  @RequirePermissions(PERMISSIONS.APPLICATION_READ_ASSIGNED)
  @ApiOperation({ summary: 'Kanban pipeline for one job requirement' })
  pipeline(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('recruiterId') recruiterId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.pipeline(jobId, user, { recruiterId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one application' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.findOne(id, user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Full stage and status change history' })
  history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.history(id, user);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Notes on an application (internal notes hidden from candidates)' })
  listNotes(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.listNotes(id, user);
  }

  @Post(':id/notes')
  @RequirePermissions(PERMISSIONS.APPLICATION_NOTE_MANAGE)
  @ApiOperation({ summary: 'Add a note to an application' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.addNote(id, dto.body, dto.isInternal ?? true, user);
  }

  @Patch(':id/transition')
  @RequirePermissions(PERMISSIONS.APPLICATION_TRANSITION)
  @ApiOperation({
    summary: 'Move an application to another stage or status',
    description:
      'Transitions are validated server-side. Drag-and-drop on the pipeline ' +
      'board calls this same endpoint, so the UI cannot bypass the rules.',
  })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.applications.transition(id, dto, user, req.ip ?? 'unknown');
  }

  @Post('bulk/transition')
  @RequirePermissions(PERMISSIONS.APPLICATION_BULK)
  @ApiOperation({ summary: 'Transition many applications; returns a per-id result' })
  bulkTransition(
    @Body() dto: BulkTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.applications.bulkTransition(dto, user, req.ip ?? 'unknown');
  }

  @Patch(':id/withdraw')
  @RequirePermissions(PERMISSIONS.APPLICATION_WITHDRAW_OWN)
  @ApiOperation({ summary: 'Withdraw your own application' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.applications.withdraw(id, dto.reason, user, req.ip ?? 'unknown');
  }

  @Patch(':id/assign')
  @RequirePermissions(PERMISSIONS.APPLICATION_ASSIGN)
  @ApiOperation({ summary: 'Assign a recruiter to an application' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.applications.assignRecruiter(id, dto.recruiterId, user, req.ip ?? 'unknown');
  }
}
