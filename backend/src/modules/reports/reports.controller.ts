import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService, ReportFilters } from './reports.service';
import { RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import { sendCsv, sendExcel } from '../../common/utils/export.util';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'List available reports and their metric definitions' })
  list() {
    return Object.entries(this.reports.registry).map(([key, entry]) => ({
      key,
      name: entry.name,
      definition: entry.definition,
    }));
  }

  @Get('offer-acceptance-summary')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Offer acceptance rate with its stated denominator' })
  offerAcceptance(@Query() filters: ReportFilters) {
    return this.reports.offerAcceptanceSummary(filters);
  }

  @Get(':key')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Run a report (JSON)' })
  async run(@Param('key') key: string, @Query() filters: ReportFilters) {
    const entry = this.reports.registry[key];
    if (!entry) {
      throw new BadRequestException(
        `Unknown report "${key}". Available: ${Object.keys(this.reports.registry).join(', ')}`,
      );
    }

    const rows = await entry.run(filters);
    return {
      key,
      name: entry.name,
      definition: entry.definition,
      filters,
      rowCount: rows.length,
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  @Get(':key/export')
  @RequirePermissions(PERMISSIONS.REPORT_EXPORT)
  @ApiOperation({ summary: 'Export a report as CSV or Excel' })
  async export(
    @Param('key') key: string,
    @Query() filters: ReportFilters,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response,
  ) {
    const entry = this.reports.registry[key];
    if (!entry) throw new BadRequestException(`Unknown report "${key}"`);

    const rows = await entry.run(filters);
    const filename = `${key}-${new Date().toISOString().slice(0, 10)}`;
    return format === 'xlsx'
      ? sendExcel(res, rows, filename, entry.name)
      : sendCsv(res, rows, filename);
  }
}
