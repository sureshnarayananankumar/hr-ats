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
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CandidatesService } from './candidates.service';
import {
  CandidateNoteDto,
  CandidateQueryDto,
  CandidateTagDto,
  UpdateCandidateDto,
} from './candidates.dto';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';
import { sendCsv, sendExcel } from '../../common/utils/export.util';

@ApiTags('Candidates')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  // ---- Self-service routes come first so "me" is not read as a UUID ----

  @Get('me')
  @RequirePermissions(PERMISSIONS.CANDIDATE_READ_OWN)
  @ApiOperation({ summary: 'Your own candidate profile' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.candidates.findMine(user);
  }

  @Patch('me')
  @RequirePermissions(PERMISSIONS.CANDIDATE_UPDATE_OWN)
  @ApiOperation({ summary: 'Update your own candidate profile' })
  async updateMine(@Body() dto: UpdateCandidateDto, @CurrentUser() user: AuthenticatedUser) {
    const profile = await this.candidates.findMine(user);
    return this.candidates.update(profile.id, dto, user);
  }

  @Post('me/request-deletion')
  @RequirePermissions(PERMISSIONS.CANDIDATE_READ_OWN)
  @ApiOperation({ summary: 'Request deletion of your personal data' })
  requestDeletion(@CurrentUser() user: AuthenticatedUser) {
    return this.candidates.requestDataDeletion(user);
  }

  // ---- Directory (HR / recruiters) ----

  @Get()
  @RequirePermissions(PERMISSIONS.CANDIDATE_READ_ANY)
  @ApiOperation({ summary: 'Search the candidate directory' })
  findAll(@Query() query: CandidateQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.candidates.findAll(query, user);
  }

  @Get('tags')
  @RequirePermissions(PERMISSIONS.CANDIDATE_READ_ANY)
  @ApiOperation({ summary: 'All candidate tags' })
  listTags() {
    return this.candidates.listTags();
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.CANDIDATE_EXPORT)
  @ApiOperation({ summary: 'Export candidates as CSV or Excel' })
  async export(
    @Query() query: CandidateQueryDto,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const rows = await this.candidates.exportRows(query, user);
    const filename = `candidates-${new Date().toISOString().slice(0, 10)}`;
    return format === 'xlsx'
      ? sendExcel(res, rows, filename, 'Candidates')
      : sendCsv(res, rows, filename);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a candidate profile (own, or with candidate.read.any)' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.candidates.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a candidate profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.update(id, dto, user);
  }

  @Get(':id/duplicates')
  @RequirePermissions(PERMISSIONS.CANDIDATE_READ_ANY)
  @ApiOperation({ summary: 'Possible duplicate profiles (advisory only)' })
  duplicates(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.candidates.findDuplicates(id, user);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Candidate activity history' })
  activity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.candidates.activity(id, user);
  }

  @Get(':id/notes')
  @RequirePermissions(PERMISSIONS.CANDIDATE_NOTE_MANAGE)
  @ApiOperation({ summary: 'Internal recruiter notes (never visible to the candidate)' })
  listNotes(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.candidates.listNotes(id, user);
  }

  @Post(':id/notes')
  @RequirePermissions(PERMISSIONS.CANDIDATE_NOTE_MANAGE)
  @ApiOperation({ summary: 'Add an internal note' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CandidateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.addNote(id, dto.body, user);
  }

  @Post(':id/tags')
  @RequirePermissions(PERMISSIONS.CANDIDATE_TAG_MANAGE)
  @ApiOperation({ summary: 'Tag a candidate' })
  addTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CandidateTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.addTag(id, dto.name, user);
  }

  @Delete(':id/tags/:tagId')
  @RequirePermissions(PERMISSIONS.CANDIDATE_TAG_MANAGE)
  @ApiOperation({ summary: 'Remove a tag from a candidate' })
  removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.candidates.removeTag(id, tagId);
  }
}
