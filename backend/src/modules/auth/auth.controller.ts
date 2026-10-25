import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  LOGIN_THROTTLE,
  MFA_THROTTLE,
  REGISTER_THROTTLE,
  RESET_THROTTLE,
} from '../../common/auth/throttle.config';
import type { Request, Response } from 'express';
import { AuthService, RequestContext, TokenPair } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  MfaCodeDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import {
  AuthenticatedUser,
  CurrentUser,
  MfaExempt,
  Public,
} from '../../common/auth/decorators';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../../common/constants';
import { generateToken } from '../../common/utils/crypto.util';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  // -----------------------------------------------------------------
  //  Registration & verification
  // -----------------------------------------------------------------

  @Public()
  // Registration is a prime target for abuse; Kong rate-limits it too.
  @Throttle(REGISTER_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Register a candidate account (public careers portal)' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.registerCandidate(dto, this.context(req));
  }

  @Public()
  @Throttle(MFA_THROTTLE)
  @Post('verify-email')
  @ApiOperation({ summary: 'Confirm an email address using the emailed token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  // -----------------------------------------------------------------
  //  Login
  // -----------------------------------------------------------------

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.login(dto.email, dto.password, this.context(req));

    if (result.mfaRequired && result.mfaToken) {
      // Half-authenticated token: only /auth/mfa/verify accepts it.
      this.setCookie(res, ACCESS_COOKIE, result.mfaToken, 5 * 60);
      return { mfaRequired: true };
    }

    this.applySession(res, result.tokens!);
    return {
      mfaRequired: false,
      user: result.user,
      expiresIn: result.tokens!.expiresIn,
    };
  }

  @MfaExempt()
  @Throttle(MFA_THROTTLE)
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete the MFA challenge and receive a full session' })
  async verifyMfa(
    @Body() dto: MfaCodeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.verifyMfa(user.userId, dto.code, this.context(req));
    this.applySession(res, result.tokens!);
    return { mfaRequired: false, user: result.user, expiresIn: result.tokens!.expiresIn };
  }

  @Post('mfa/setup')
  @ApiOperation({ summary: 'Begin MFA enrolment; returns a TOTP secret and otpauth URI' })
  async beginMfaSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.beginMfaSetup(user.userId);
  }

  @Post('mfa/confirm')
  @ApiOperation({ summary: 'Confirm MFA enrolment; returns one-time recovery codes' })
  async confirmMfaSetup(
    @Body() dto: MfaCodeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.auth.confirmMfaSetup(user.userId, dto.code, this.context(req));
  }

  // -----------------------------------------------------------------
  //  Session lifecycle
  // -----------------------------------------------------------------

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No session to refresh');

    const tokens = await this.auth.refresh(token, this.context(req));
    this.applySession(res, tokens);
    return { expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.logout(
      req.cookies?.[REFRESH_COOKIE],
      user.userId,
      this.context(req),
    );
    this.clearCookies(res);
    return result;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeAllSessions(user.userId, 'USER_LOGOUT_ALL');
    this.clearCookies(res);
    return { message: 'All sessions revoked' };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List the current user active sessions' })
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.userId);
  }

  // -----------------------------------------------------------------
  //  Password management
  // -----------------------------------------------------------------

  @Public()
  @Throttle(RESET_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password-reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.requestPasswordReset(dto.email, this.context(req));
  }

  @Public()
  @Throttle(RESET_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using an emailed reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto.token, dto.newPassword, this.context(req));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change your own password' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
      this.context(req),
    );
    this.clearCookies(res);
    return result;
  }

  // -----------------------------------------------------------------

  @Get('me')
  @ApiOperation({ summary: 'Current user profile, roles and permissions' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.userId);
  }

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Issue a CSRF token for the double-submit cookie pattern' })
  csrf(@Res({ passthrough: true }) res: Response) {
    const token = generateToken(24);
    // Readable by JS on purpose: the client echoes it in a header, and
    // the same-origin policy stops other sites from reading the cookie.
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: this.config.get<boolean>('cookies.secure'),
      sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookies.sameSite'),
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return { csrfToken: token };
  }

  // -----------------------------------------------------------------
  //  Helpers
  // -----------------------------------------------------------------

  private context(req: Request): RequestContext {
    return {
      // req.ip is derived from Express's trust-proxy setting, which is
      // pinned to the gateway hop count so clients cannot spoof it.
      ip: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }

  private applySession(res: Response, tokens: TokenPair): void {
    this.setCookie(res, ACCESS_COOKIE, tokens.accessToken, tokens.expiresIn);
    this.setCookie(
      res,
      REFRESH_COOKIE,
      tokens.refreshToken,
      this.config.get<number>('jwt.refreshTtlSeconds') ?? 604800,
      // Scoped so the refresh token is only ever sent to the auth routes.
      `/${this.config.get<string>('apiPrefix')}/auth`,
    );
  }

  private setCookie(
    res: Response,
    name: string,
    value: string,
    maxAgeSeconds: number,
    path = '/',
  ): void {
    const domain = this.config.get<string>('cookies.domain');
    res.cookie(name, value, {
      httpOnly: true, // never readable by JavaScript -> XSS cannot steal it
      secure: this.config.get<boolean>('cookies.secure'),
      sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookies.sameSite'),
      // Omitted unless explicitly configured: a host-only cookie is not
      // sent to sibling subdomains, which is the safer default.
      ...(domain ? { domain } : {}),
      path,
      maxAge: maxAgeSeconds * 1000,
    });
  }

  private clearCookies(res: Response): void {
    const domain = this.config.get<string>('cookies.domain');
    const options = {
      httpOnly: true,
      secure: this.config.get<boolean>('cookies.secure'),
      sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookies.sameSite'),
      ...(domain ? { domain } : {}),
    };
    res.clearCookie(ACCESS_COOKIE, { ...options, path: '/' });
    res.clearCookie(REFRESH_COOKIE, {
      ...options,
      path: `/${this.config.get<string>('apiPrefix')}/auth`,
    });
  }
}
