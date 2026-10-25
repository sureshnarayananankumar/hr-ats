import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, BLOCKED_UPLOAD_EXTENSIONS } from '../../common/constants';
import { sha256File } from '../../common/utils/crypto.util';
import type { AuthenticatedUser } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

/** Magic-byte signatures for the formats we accept. */
const FILE_SIGNATURES: Array<{ mime: string; test: (buffer: Buffer) => boolean }> = [
  {
    mime: 'application/pdf',
    test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  },
  {
    // DOCX is a ZIP container (PK\x03\x04).
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07),
  },
  {
    // Legacy .doc -- OLE compound file.
    mime: 'application/msword',
    test: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
];

const EXTENSION_FOR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get storageRoot(): string {
    return this.config.get<string>('storage.root')!;
  }

  /**
   * Validates and stores an uploaded document.
   *
   * Defence in depth:
   *  1. size limit
   *  2. declared MIME must be on the allow-list
   *  3. extension blocklist (executables, scripts, SVG, HTML)
   *  4. magic bytes must match the declared MIME -- a renamed .exe fails
   *  5. the stored filename is server-generated; the client name is only
   *     ever metadata, never part of a path
   */
  async upload(
    candidateId: string,
    file: Express.Multer.File,
    documentType: DocumentType,
    user: AuthenticatedUser,
    ip: string,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded');

    const maxBytes = this.config.get<number>('storage.maxUploadBytes')!;
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit`,
      );
    }
    if (file.size === 0) throw new BadRequestException('The uploaded file is empty');

    const allowedMimes = this.config.get<string[]>('storage.allowedMimeTypes')!;
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${allowedMimes.join(', ')}`,
      );
    }

    const originalExtension = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_UPLOAD_EXTENSIONS.includes(originalExtension)) {
      await this.audit.log({
        action: 'UPLOAD_BLOCKED',
        actorUserId: user.userId,
        severity: 'WARN',
        metadata: { extension: originalExtension, declaredMime: file.mimetype },
        ipAddress: ip,
      });
      throw new BadRequestException('That file type is not permitted');
    }

    // Content must actually be what the client claims it is.
    const signature = FILE_SIGNATURES.find((entry) => entry.mime === file.mimetype);
    if (!signature || !signature.test(file.buffer)) {
      await this.audit.log({
        action: 'UPLOAD_BLOCKED',
        actorUserId: user.userId,
        severity: 'WARN',
        metadata: { reason: 'MIME_CONTENT_MISMATCH', declaredMime: file.mimetype },
        ipAddress: ip,
      });
      throw new BadRequestException(
        'The file contents do not match its declared type',
      );
    }

    const checksum = sha256File(file.buffer);

    // Opaque, server-generated name. No client input reaches the path.
    const extension = EXTENSION_FOR_MIME[file.mimetype] ?? '.bin';
    const storageKey = `${candidateId}/${randomUUID()}${extension}`;
    const absolutePath = this.resolveStoragePath(storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { mode: 0o640 });

    const document = await this.prisma.$transaction(async (tx) => {
      // Resumes are versioned: the previous current one is superseded,
      // not deleted, so historic applications still reference what was
      // actually submitted at the time.
      let version = 1;
      let supersedesId: string | undefined;

      if (documentType === DocumentType.RESUME) {
        const current = await tx.candidateDocument.findFirst({
          where: { candidateId, documentType, isCurrent: true, deletedAt: null },
          orderBy: { version: 'desc' },
        });
        if (current) {
          version = current.version + 1;
          supersedesId = current.id;
          await tx.candidateDocument.update({
            where: { id: current.id },
            data: { isCurrent: false },
          });
        }
      }

      return tx.candidateDocument.create({
        data: {
          candidateId,
          documentType,
          originalName: this.sanitiseName(file.originalname),
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
          version,
          isCurrent: true,
          supersedesId,
        },
      });
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'CandidateDocument',
      entityId: document.id,
      metadata: {
        documentType,
        sizeBytes: file.size,
        version: document.version,
        // The filename is recorded; the contents never are.
        originalName: document.originalName,
      },
      ipAddress: ip,
    });

    return this.toPublicShape(document);
  }

  /**
   * Streams a document to an authorised caller.
   *
   * There is no public URL for any candidate document: every read goes
   * through this authenticated endpoint and is recorded.
   */
  async download(id: string, user: AuthenticatedUser, ip: string) {
    const document = await this.prisma.candidateDocument.findUnique({
      where: { id },
      include: { candidate: { select: { id: true, userId: true } } },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    await this.assertCanAccess(document, user, ip);

    const absolutePath = this.resolveStoragePath(document.storageKey);

    try {
      await stat(absolutePath);
    } catch {
      this.logger.error(`Document row ${id} has no file at ${document.storageKey}`);
      throw new NotFoundException('Document file is unavailable');
    }

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: id,
        userId: user.userId,
        ipAddress: ip.slice(0, 45),
        action: 'DOWNLOAD',
      },
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOADED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'CandidateDocument',
      entityId: id,
      metadata: { candidateId: document.candidateId },
      ipAddress: ip,
    });

    return {
      stream: createReadStream(absolutePath),
      mimeType: document.mimeType,
      filename: document.originalName,
      sizeBytes: document.sizeBytes,
    };
  }

  /**
   * Ownership / role check for a single document.
   * A candidate may only ever reach their own files.
   */
  private async assertCanAccess(
    document: { candidateId: string; candidate: { userId: string } },
    user: AuthenticatedUser,
    ip: string,
  ): Promise<void> {
    const isOwner = document.candidate.userId === user.userId;
    if (isOwner && user.permissions.includes(PERMISSIONS.DOCUMENT_READ_OWN)) return;
    if (user.permissions.includes(PERMISSIONS.DOCUMENT_READ_ANY)) return;

    await this.audit.log({
      action: AUDIT_ACTIONS.DOCUMENT_ACCESS_DENIED,
      actorUserId: user.userId,
      actorEmail: user.email,
      entityType: 'CandidateDocument',
      severity: 'WARN',
      metadata: { attemptedCandidateId: document.candidateId },
      ipAddress: ip,
    });

    throw new ForbiddenException('You do not have access to this document');
  }

  async listForCandidate(candidateId: string, user: AuthenticatedUser) {
    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { id: true, userId: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const isOwner = candidate.userId === user.userId;
    if (!isOwner && !user.permissions.includes(PERMISSIONS.DOCUMENT_READ_ANY)) {
      throw new ForbiddenException('You do not have access to these documents');
    }

    const documents = await this.prisma.candidateDocument.findMany({
      where: { candidateId, deletedAt: null },
      orderBy: [{ documentType: 'asc' }, { version: 'desc' }],
    });

    return documents.map((document) => this.toPublicShape(document));
  }

  /** Soft delete. The row and its access history are retained. */
  async remove(id: string, user: AuthenticatedUser, ip: string) {
    const document = await this.prisma.candidateDocument.findUnique({
      where: { id },
      include: { candidate: { select: { userId: true } } },
    });
    if (!document || document.deletedAt) throw new NotFoundException('Document not found');

    const isOwner = document.candidate.userId === user.userId;
    if (!isOwner && !user.permissions.includes(PERMISSIONS.DOCUMENT_READ_ANY)) {
      throw new ForbiddenException('You cannot delete this document');
    }

    const linkedApplications = await this.prisma.jobApplication.count({
      where: { resumeDocumentId: id },
    });
    if (linkedApplications > 0) {
      throw new BadRequestException(
        'This resume is attached to a submitted application and cannot be deleted',
      );
    }

    await this.prisma.candidateDocument.update({
      where: { id },
      data: { deletedAt: new Date(), isCurrent: false },
    });

    await unlink(this.resolveStoragePath(document.storageKey)).catch(() => {
      this.logger.warn(`Could not remove file for document ${id}`);
    });

    await this.audit.log({
      action: 'DOCUMENT_DELETED',
      actorUserId: user.userId,
      entityType: 'CandidateDocument',
      entityId: id,
      ipAddress: ip,
    });

    return { message: 'Document deleted' };
  }

  async accessLog(id: string, user: AuthenticatedUser) {
    if (!user.permissions.includes(PERMISSIONS.AUDIT_READ)) {
      throw new ForbiddenException('Missing permission: audit.read');
    }
    const rows = await this.prisma.documentAccessLog.findMany({
      where: { documentId: id },
      orderBy: { accessedAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  }

  // ===================================================================
  //  Path safety
  // ===================================================================

  /**
   * Resolves a storage key to an absolute path and proves the result is
   * still inside the storage root. Any `..` or absolute-path trickery in
   * a key is caught here rather than reaching the filesystem.
   */
  private resolveStoragePath(storageKey: string): string {
    const root = path.resolve(this.storageRoot);
    const resolved = path.resolve(root, storageKey);

    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      this.logger.error(`Path traversal attempt blocked for key: ${storageKey}`);
      throw new ForbiddenException('Invalid document reference');
    }

    return resolved;
  }

  /** Keeps a readable name for display without letting it touch a path. */
  private sanitiseName(name: string): string {
    return path
      .basename(name)
      .replace(/[^A-Za-z0-9._ -]/g, '_')
      .slice(0, 255);
  }

  /** The storage key never leaves the server. */
  private toPublicShape(document: Record<string, any>) {
    return {
      id: document.id,
      candidateId: document.candidateId,
      documentType: document.documentType,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      version: document.version,
      isCurrent: document.isCurrent,
      uploadedAt: document.uploadedAt,
      downloadUrl: `/api/documents/${document.id}/download`,
    };
  }
}
