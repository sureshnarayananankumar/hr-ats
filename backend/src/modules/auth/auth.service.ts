import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleName, UserStatus } from '@prisma/client';
import { authenticator } from 'otplib';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUDIT_ACTIONS } from '../../common/constants';
import {
  generateRecoveryCodes,
  generateToken,
  hashPassword,
  hashToken,
  validatePasswordStrength,
  verifyPassword,
} from '../../common/utils/crypto.util';
import { generateCandidateCode, normaliseEmail, normalisePhone } from '../../common/utils/codes.util';
import { ROLE_PERMISSIONS } from '../../common/auth/permissions';

export interface RequestContext {
  ip: string;
  userAgent?: string;
  requestId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  tokens?: TokenPair;
  /** True when the caller must now complete an MFA challenge. */
  mfaRequired: boolean;
  /** Short-lived half-authenticated token used only for /auth/mfa/verify. */
  mfaToken?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: RoleName[];
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===================================================================
  //  Registration (candidates self-register on the careers portal)
  // ===================================================================

  async registerCandidate(
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      consentToStoreData: boolean;
    },
    ctx: RequestContext,
  ) {
    const email = normaliseEmail(input.email);

    const strengthErrors = validatePasswordStrength(input.password);
    if (strengthErrors.length > 0) {
      throw new BadRequestException({ message: strengthErrors, error: 'Weak Password' });
    }

    if (!input.consentToStoreData) {
      throw new BadRequestException(
        'Consent to store your data is required to create a candidate account',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Do NOT reveal that the address is registered -- that would turn
      // this endpoint into an account-enumeration oracle. The response
      // is identical to the success path; a "someone tried to register
      // with your address" email goes to the real owner instead.
      await this.notifications.queueTemplate('account.duplicate_registration', email, {
        firstName: existing.firstName,
      });
      return { message: 'Check your email to verify your account.' };
    }

    const passwordHash = await hashPassword(input.password);

    const { user, verificationToken } = await this.prisma.$transaction(async (tx) => {
      const candidateRole = await tx.role.findUniqueOrThrow({
        where: { name: RoleName.CANDIDATE },
      });

      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone?.trim(),
          status: UserStatus.PENDING_VERIFICATION,
          consentGivenAt: new Date(),
          userRoles: { create: { roleId: candidateRole.id } },
        },
      });

      await tx.candidateProfile.create({
        data: {
          candidateCode: await generateCandidateCode(tx),
          userId: created.id,
          fullName: `${input.firstName.trim()} ${input.lastName.trim()}`,
          normalisedEmail: email,
          normalisedPhone: normalisePhone(input.phone),
          mobile: input.phone?.trim(),
          consentToStoreData: true,
          consentAt: new Date(),
        },
      });

      const rawToken = generateToken();
      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return { user: created, verificationToken: rawToken };
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.USER_CREATED,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'User',
      entityId: user.id,
      metadata: { role: 'CANDIDATE', self_registered: true },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    await this.notifications.queueTemplate('account.verify_email', user.email, {
      firstName: user.firstName,
      verifyUrl: `${this.config.get('frontendUrl')}/verify-email?token=${verificationToken}`,
    });

    return { message: 'Check your email to verify your account.' };
  }

  async verifyEmail(rawToken: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
      }),
    ]);

    return { message: 'Email verified. You can now sign in.' };
  }

  // ===================================================================
  //  Login
  // ===================================================================

  async login(email: string, password: string, ctx: RequestContext): Promise<LoginResult> {
    const normalised = normaliseEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
      include: {
        userRoles: { include: { role: true } },
        candidateProfile: { select: { id: true } },
      },
    });

    // Uniform failure handling: the same message and broadly the same
    // work regardless of whether the account exists.
    if (!user) {
      await hashPassword(password).catch(() => undefined); // equalise timing
      await this.recordFailedLogin(normalised, ctx, 'UNKNOWN_ACCOUNT');
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordFailedLogin(normalised, ctx, 'ACCOUNT_LOCKED');
      throw new UnauthorizedException(
        'This account is temporarily locked. Please try again later.',
      );
    }

    const passwordValid = await verifyPassword(user.passwordHash, password);
    if (!passwordValid) {
      await this.handleFailedPassword(user.id, normalised, ctx);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException('Please verify your email address before signing in');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('This account is not active');
    }

    // Successful password -> clear the failure counter.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ctx.ip,
      },
    });

    const roles = user.userRoles.map((link) => link.role.name);
    const permissions = this.permissionsForRoles(roles);

    // Privileged roles must clear MFA before getting a real session.
    const mfaRequiredRoles = this.config.get<string[]>('security.mfaRequiredRoles') ?? [];
    const needsMfa =
      user.mfaEnabled || roles.some((role) => mfaRequiredRoles.includes(role));

    if (needsMfa && user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, email: user.email, roles, permissions, mfa: false, sid: 'pending' },
        { secret: this.config.get('jwt.accessSecret'), expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }

    if (needsMfa && !user.mfaEnabled) {
      // Policy requires MFA for this role but it has not been set up.
      // Issue a session flagged so the UI forces enrolment immediately.
      this.logger.warn(`User ${user.id} holds a privileged role without MFA enrolled`);
    }

    const tokens = await this.issueSession(user.id, ctx);
    await this.audit.log({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      actorUserId: user.id,
      actorEmail: user.email,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    await this.recordLoginAttempt(normalised, ctx, true);

    return {
      tokens,
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions,
      },
    };
  }

  private async handleFailedPassword(userId: string, email: string, ctx: RequestContext) {
    const maxFailed = this.config.get<number>('security.maxFailedLogins') ?? 5;
    const lockoutMinutes = this.config.get<number>('security.lockoutMinutes') ?? 15;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true, email: true },
    });

    if (updated.failedLoginCount >= maxFailed) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000),
          failedLoginCount: 0,
        },
      });
      await this.audit.log({
        action: AUDIT_ACTIONS.LOGIN_LOCKED,
        actorUserId: userId,
        actorEmail: updated.email,
        severity: 'WARN',
        metadata: { lockoutMinutes, threshold: maxFailed },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
    }

    await this.recordFailedLogin(email, ctx, 'BAD_PASSWORD', userId);
  }

  private async recordFailedLogin(
    email: string,
    ctx: RequestContext,
    reason: string,
    userId?: string,
  ) {
    await this.recordLoginAttempt(email, ctx, false, reason);
    await this.audit.log({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorUserId: userId ?? null,
      actorEmail: email,
      severity: 'WARN',
      metadata: { reason },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  private async recordLoginAttempt(
    email: string,
    ctx: RequestContext,
    successful: boolean,
    reason?: string,
  ) {
    await this.prisma.loginAttempt
      .create({
        data: {
          email: email.slice(0, 255),
          ipAddress: ctx.ip.slice(0, 45),
          successful,
          reason: reason?.slice(0, 100),
          userAgent: ctx.userAgent?.slice(0, 400),
        },
      })
      .catch(() => undefined);
  }

  // ===================================================================
  //  MFA
  // ===================================================================

  async beginMfaSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'HR ATS', secret);

    // Held unverified until the user proves possession with a code.
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    return { secret, otpauth };
  }

  async confirmMfaSetup(userId: string, code: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new BadRequestException('Start MFA setup first');

    if (!authenticator.verify({ token: code, secret: user.mfaSecret })) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = recoveryCodes.map((entry) => hashToken(entry));

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaRecoveryCodes: JSON.stringify(hashedCodes) },
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.MFA_ENABLED,
      actorUserId: userId,
      actorEmail: user.email,
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
    });

    // Shown exactly once -- never retrievable again.
    return { recoveryCodes };
  }

  async verifyMfa(userId: string, code: string, ctx: RequestContext): Promise<LoginResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        candidateProfile: { select: { id: true } },
      },
    });

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    let accepted = authenticator.verify({ token: code, secret: user.mfaSecret });

    // Fall back to a single-use recovery code.
    if (!accepted && user.mfaRecoveryCodes) {
      const stored: string[] = JSON.parse(user.mfaRecoveryCodes);
      const candidate = hashToken(code.trim().toUpperCase());
      const index = stored.indexOf(candidate);
      if (index >= 0) {
        stored.splice(index, 1);
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaRecoveryCodes: JSON.stringify(stored) },
        });
        accepted = true;
      }
    }

    if (!accepted) {
      await this.audit.log({
        action: AUDIT_ACTIONS.MFA_FAILED,
        actorUserId: userId,
        actorEmail: user.email,
        severity: 'WARN',
        ipAddress: ctx.ip,
        requestId: ctx.requestId,
      });
      throw new UnauthorizedException('Invalid authentication code');
    }

    const roles = user.userRoles.map((link) => link.role.name);
    const tokens = await this.issueSession(user.id, ctx);

    await this.audit.log({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      actorUserId: user.id,
      actorEmail: user.email,
      metadata: { mfa: true },
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
    });

    return {
      tokens,
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions: this.permissionsForRoles(roles),
      },
    };
  }

  // ===================================================================
  //  Sessions: issue, rotate, revoke
  // ===================================================================

  /** Creates a server-side session row and the matching token pair. */
  async issueSession(userId: string, ctx: RequestContext): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        candidateProfile: { select: { id: true } },
      },
    });

    const roles = user.userRoles.map((link) => link.role.name);
    const permissions = this.permissionsForRoles(roles);
    const refreshTtl = this.config.get<number>('jwt.refreshTtlSeconds') ?? 604800;
    const accessTtl = this.config.get<number>('jwt.accessTtlSeconds') ?? 900;

    const rawRefresh = generateToken(48);
    const session = await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefresh),
        userAgent: ctx.userAgent?.slice(0, 400),
        ipAddress: ctx.ip.slice(0, 45),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    const accessToken = await this.jwt.signAsync(
      {
        sub: userId,
        email: user.email,
        roles,
        permissions,
        candidateId: user.candidateProfile?.id,
        sid: session.id,
        mfa: true,
      },
      { secret: this.config.get('jwt.accessSecret'), expiresIn: accessTtl },
    );

    return { accessToken, refreshToken: rawRefresh, expiresIn: accessTtl };
  }

  /**
   * Rotates a refresh token.
   *
   * Presenting an already-rotated token means it leaked, so the entire
   * session family is revoked rather than just rejecting the request.
   */
  async refresh(rawRefresh: string, ctx: RequestContext): Promise<TokenPair> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(rawRefresh) },
      include: { user: { select: { id: true, email: true, status: true } } },
    });

    if (!session) throw new UnauthorizedException('Invalid session');

    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId, 'REFRESH_TOKEN_REUSE');
      await this.audit.log({
        action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
        actorUserId: session.userId,
        actorEmail: session.user.email,
        severity: 'CRITICAL',
        metadata: { sessionId: session.id },
        ipAddress: ctx.ip,
        requestId: ctx.requestId,
      });
      throw new UnauthorizedException('Session revoked. Please sign in again.');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('This account is not active');
    }

    const tokens = await this.issueSession(session.userId, ctx);

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
    });

    return tokens;
  }

  async logout(rawRefresh: string | undefined, userId: string, ctx: RequestContext) {
    if (rawRefresh) {
      await this.prisma.refreshSession
        .updateMany({
          where: { tokenHash: hashToken(rawRefresh), revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'USER_LOGOUT' },
        })
        .catch(() => undefined);
    }

    await this.audit.log({
      action: AUDIT_ACTIONS.LOGOUT,
      actorUserId: userId,
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
    });

    return { message: 'Signed out' };
  }

  async revokeAllSessions(userId: string, reason: string) {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason.slice(0, 200) },
    });
  }

  async listSessions(userId: string) {
    return this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ===================================================================
  //  Password reset
  // ===================================================================

  async requestPasswordReset(email: string, ctx: RequestContext) {
    const normalised = normaliseEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalised } });

    // Always the same response, to avoid account enumeration.
    const response = {
      message: 'If an account exists for that address, a reset link has been sent.',
    };
    if (!user) return response;

    const rawToken = generateToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        requestIp: ctx.ip.slice(0, 45),
      },
    });

    await this.audit.log({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      actorUserId: user.id,
      actorEmail: user.email,
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
    });

    await this.notifications.queueTemplate('account.password_reset', user.email, {
      firstName: user.firstName,
      resetUrl: `${this.config.get('frontendUrl')}/reset-password?token=${rawToken}`,
    });

    return response;
  }

  async resetPassword(rawToken: string, newPassword: string, ctx: RequestContext) {
    const strengthErrors = validatePasswordStrength(newPassword);
    if (strengthErrors.length > 0) {
      throw new BadRequestException({ message: strengthErrors, error: 'Weak Password' });
    }

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      // Changing a password invalidates every existing session.
      this.prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
      }),
    ]);

    await this.audit.log({
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      actorUserId: record.userId,
      actorEmail: record.user.email,
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
    });

    return { message: 'Password updated. Please sign in.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const strengthErrors = validatePasswordStrength(newPassword);
    if (strengthErrors.length > 0) {
      throw new BadRequestException({ message: strengthErrors, error: 'Weak Password' });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await this.revokeAllSessions(userId, 'PASSWORD_CHANGED');

    await this.audit.log({
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      actorUserId: userId,
      actorEmail: user.email,
      metadata: { selfService: true },
      ipAddress: ctx.ip,
      requestId: ctx.requestId,
    });

    return { message: 'Password updated. Please sign in again.' };
  }

  // ===================================================================

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        candidateProfile: { select: { id: true, candidateCode: true } },
      },
    });

    const roles = user.userRoles.map((link) => link.role.name);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      emailVerified: Boolean(user.emailVerifiedAt),
      roles,
      permissions: this.permissionsForRoles(roles),
      candidateId: user.candidateProfile?.id,
      candidateCode: user.candidateProfile?.candidateCode,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /** Union of the permission bundles for the user's roles. */
  private permissionsForRoles(roles: RoleName[]): string[] {
    const set = new Set<string>();
    for (const role of roles) {
      for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
    }
    return [...set];
  }
}
