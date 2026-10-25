import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

@ApiTags('Dashboard')
@Controller('dashboard')
@RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Headline counters (all live database counts)' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.summary(user);
  }

  @Get('applications-by-month')
  @ApiOperation({ summary: 'Applications and hires per month' })
  applicationsByMonth(@Query('months') months?: string) {
    return this.dashboard.applicationsByMonth(
      Math.min(Math.max(Number.parseInt(months ?? '12', 10) || 12, 1), 36),
    );
  }

  @Get('candidates-by-stage')
  @ApiOperation({ summary: 'Active candidates per recruitment stage' })
  candidatesByStage() {
    return this.dashboard.candidatesByStage();
  }

  @Get('vacancies-by-department')
  @ApiOperation({ summary: 'Open vacancies grouped by department' })
  vacanciesByDepartment() {
    return this.dashboard.vacanciesByDepartment();
  }

  @Get('source-performance')
  @ApiOperation({ summary: 'Applications and hires per recruitment source' })
  sourcePerformance() {
    return this.dashboard.sourcePerformance();
  }

  @Get('recruiter-performance')
  @ApiOperation({ summary: 'Per-recruiter workload and hire rate' })
  recruiterPerformance() {
    return this.dashboard.recruiterPerformance();
  }

  @Get('time-metrics')
  @ApiOperation({ summary: 'Time-to-hire and time-to-fill, with stated definitions' })
  timeMetrics() {
    return this.dashboard.timeMetrics();
  }

  @Get('vacancy-fulfilment')
  @ApiOperation({ summary: 'Fulfilment rate per job requirement' })
  vacancyFulfilment() {
    return this.dashboard.vacancyFulfilment();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Recent activity feed' })
  recentActivity(@Query('limit') limit?: string) {
    return this.dashboard.recentActivity(
      Math.min(Math.max(Number.parseInt(limit ?? '15', 10) || 15, 1), 50),
    );
  }

  @Get('pending-actions')
  @ApiOperation({ summary: 'Items awaiting your action' })
  pendingActions(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.pendingActions(user);
  }
}
