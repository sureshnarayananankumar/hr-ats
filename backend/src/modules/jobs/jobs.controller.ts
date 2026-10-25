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
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JobsService } from './jobs.service';
import {
  ApprovalDecisionDto,
  AssignRecruiterDto,
  ChangeJobStatusDto,
  CreateJobDto,
  JobQueryDto,
  SubmitForApprovalDto,
  UpdateJobDto,
} from './jobs.dto';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import { sendCsv, sendExcel } from '../../common/utils/export.util';

@ApiTags('Job Requirements')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.JOB_READ_ASSIGNED)
  @ApiOperation({ summary: 'List job requirements (scoped to what you may see)' })
  findAll(@Query() query: JobQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.findAll(query, user);
  }

  @Get('pending-approvals')
  @RequirePermissions(PERMISSIONS.JOB_APPROVE)
  @ApiOperation({ summary: 'Job requirements awaiting your approval' })
  pendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.pendingApprovals(user);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.JOB_EXPORT)
  @ApiOperation({ summary: 'Export job requirements as CSV or Excel' })
  async export(
    @Query() query: JobQueryDto,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const rows = await this.jobs.exportRows(query, user);
    const filename = `job-requirements-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'xlsx') {
      return sendExcel(res, rows, filename, 'Job Requirements');
    }
    return sendCsv(res, rows, filename);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.JOB_READ_ASSIGNED)
  @ApiOperation({ summary: 'Get one job requirement' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.findOne(id, user);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.JOB_READ_ASSIGNED)
  @ApiOperation({ summary: 'Full field-level change history' })
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.history(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.JOB_CREATE)
  @ApiOperation({ summary: 'Create a job requirement (saved as DRAFT)' })
  create(
    @Body() dto: CreateJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.create(dto, user, req.ip ?? 'unknown');
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.JOB_UPDATE)
  @ApiOperation({ summary: 'Update a job requirement' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.update(id, dto, user, req.ip ?? 'unknown');
  }

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.JOB_SUBMIT)
  @ApiOperation({ summary: 'Submit a draft for approval' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitForApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.submitForApproval(id, dto.approverIds, user, req.ip ?? 'unknown');
  }

  @Post(':id/approval')
  @RequirePermissions(PERMISSIONS.JOB_APPROVE)
  @ApiOperation({ summary: 'Approve or reject a job requirement' })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.decideApproval(id, dto.decision, dto.comments, user, req.ip ?? 'unknown');
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.JOB_READ_ASSIGNED)
  @ApiOperation({
    summary: 'Change job status (publish, hold, close, reopen, cancel)',
    description:
      'The transition is validated server-side and the specific permission ' +
      'for the target status is enforced inside the service.',
  })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeJobStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.changeStatus(id, dto.status, user, {
      reason: dto.reason,
      ip: req.ip ?? 'unknown',
    });
  }

  @Post(':id/duplicate')
  @RequirePermissions(PERMISSIONS.JOB_DUPLICATE)
  @ApiOperation({ summary: 'Duplicate a requirement as a new draft' })
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.duplicate(id, user, req.ip ?? 'unknown');
  }

  @Patch(':id/recruiter')
  @RequirePermissions(PERMISSIONS.JOB_ASSIGN_RECRUITER)
  @ApiOperation({ summary: 'Assign a recruiter to the requirement' })
  assignRecruiter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRecruiterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.jobs.assignRecruiter(id, dto.recruiterId, user, req.ip ?? 'unknown');
  }
}
