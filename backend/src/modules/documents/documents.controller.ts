import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import type { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD_OWN)
  // memoryStorage keeps the bytes off disk until they have passed every
  // check, so a rejected upload never lands in the filesystem.
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document for your own candidate profile' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: Object.values(DocumentType) },
      },
    },
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: DocumentType = DocumentType.RESUME,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!user.candidateId) {
      throw new ForbiddenException('Only candidate accounts can upload documents here');
    }
    // Bound to the token's candidate id -- a caller cannot upload into
    // another candidate's folder by passing a different id.
    return this.documents.upload(
      user.candidateId,
      file,
      documentType,
      user,
      req.ip ?? 'unknown',
    );
  }

  @Get('candidate/:candidateId')
  @ApiOperation({ summary: 'List a candidate documents (own, or with document.read.any)' })
  list(
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.listForCandidate(candidateId, user);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download a document',
    description:
      'The only way to read a stored document. Access is checked per ' +
      'record and every download is logged.',
  })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.documents.download(id, user, req.ip ?? 'unknown');

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.sizeBytes);
    // attachment + nosniff stops the browser rendering an uploaded file
    // inline, which is what would turn a crafted document into stored XSS.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/["\\]/g, '_')}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    result.stream.pipe(res);
  }

  @Get(':id/access-log')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Who has accessed this document' })
  accessLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.accessLog(id, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE_OWN)
  @ApiOperation({ summary: 'Delete a document you own' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.documents.remove(id, user, req.ip ?? 'unknown');
  }
}
