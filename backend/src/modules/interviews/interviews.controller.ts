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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InterviewsService } from './interviews.service';
import {
  CancelInterviewDto,
  FeedbackDto,
  InterviewQueryDto,
  RescheduleDto,
  ScheduleInterviewDto,
} from './interviews.dto';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

@ApiTags('Interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List interviews visible to you' })
  findAll(@Query() query: InterviewQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.findAll(query, user);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Calendar events for a date range' })
  calendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interviews.calendar(from, to, user);
  }

  @Get('my-pending-feedback')
  @RequirePermissions(PERMISSIONS.FEEDBACK_SUBMIT)
  @ApiOperation({ summary: 'Your completed interviews still awaiting feedback' })
  pendingFeedback(@CurrentUser() user: AuthenticatedUser) {
    return this.interviews.myPendingFeedback(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one interview' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.findOne(id, user);
  }

  @Get(':id/feedback')
  @ApiOperation({
    summary: 'Interview feedback',
    description:
      'Restricted to HR, hiring managers and the panel. Candidates can ' +
      'never read evaluation records.',
  })
  listFeedback(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.listFeedback(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INTERVIEW_SCHEDULE)
  @ApiOperation({ summary: 'Schedule an interview (returns any panel conflicts)' })
  schedule(
    @Body() dto: ScheduleInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.interviews.schedule(dto, user, req.ip ?? 'unknown');
  }

  @Patch(':id/reschedule')
  @RequirePermissions(PERMISSIONS.INTERVIEW_RESCHEDULE)
  @ApiOperation({ summary: 'Reschedule an interview' })
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.interviews.reschedule(id, dto, user, req.ip ?? 'unknown');
  }

  @Patch(':id/cancel')
  @RequirePermissions(PERMISSIONS.INTERVIEW_CANCEL)
  @ApiOperation({ summary: 'Cancel an interview' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.interviews.cancel(id, dto.reason, user, req.ip ?? 'unknown');
  }

  @Patch(':id/complete')
  @RequirePermissions(PERMISSIONS.INTERVIEW_SCHEDULE)
  @ApiOperation({ summary: 'Mark an interview as completed' })
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.markCompleted(id, user);
  }

  @Post(':id/feedback')
  @RequirePermissions(PERMISSIONS.FEEDBACK_SUBMIT)
  @ApiOperation({ summary: 'Submit or update your interview feedback' })
  submitFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.interviews.submitFeedback(id, dto, user, req.ip ?? 'unknown');
  }
}
