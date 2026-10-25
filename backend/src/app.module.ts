import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import configuration, { validateEnv } from './common/config/configuration';
import { PrismaService } from './common/prisma/prisma.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { GatewayGuard, JwtAuthGuard, PermissionsGuard } from './common/auth/guards';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { AuditService } from './modules/audit/audit.service';
import { NotificationsService } from './modules/notifications/notifications.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { JobsController } from './modules/jobs/jobs.controller';
import { JobsService } from './modules/jobs/jobs.service';
import { CandidatesController } from './modules/candidates/candidates.controller';
import { CandidatesService } from './modules/candidates/candidates.service';
import { DocumentsController } from './modules/documents/documents.controller';
import { DocumentsService } from './modules/documents/documents.service';
import { ApplicationsController } from './modules/applications/applications.controller';
import { ApplicationsService } from './modules/applications/applications.service';
import { InterviewsController } from './modules/interviews/interviews.controller';
import { InterviewsService } from './modules/interviews/interviews.service';
import { OffersController } from './modules/offers/offers.controller';
import { OffersService } from './modules/offers/offers.service';
import { OnboardingController } from './modules/onboarding/onboarding.controller';
import { OnboardingService } from './modules/onboarding/onboarding.service';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { DashboardService } from './modules/dashboard/dashboard.service';
import { ReportsController } from './modules/reports/reports.controller';
import { ReportsService } from './modules/reports/reports.service';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { PublicController } from './modules/public/public.controller';
import { HealthController } from './modules/health/health.controller';
import { TasksService } from './modules/tasks/tasks.service';

/**
 * Prisma is shared process-wide; a second client would open a second
 * connection pool against the same database for no benefit.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
class PrismaModule {}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Refuses to boot on a missing or weak secret.
      validate: validateEnv,
      cache: true,
    }),

    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<number>('jwt.accessTtlSeconds') },
      }),
    }),

    /**
     * Application-level rate limiting.
     *
     * Kong also rate-limits at the edge; this is the second layer, so a
     * request that somehow reaches the container directly is still
     * throttled. Per-route limits are set with @Throttle.
     */
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),

    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Files stay in memory until they pass validation, so a rejected
        // upload never touches the filesystem.
        storage: memoryStorage(),
        limits: {
          fileSize: config.get<number>('storage.maxUploadBytes'),
          files: 1,
          fields: 10,
        },
      }),
    }),

    ScheduleModule.forRoot(),
    PrismaModule,
  ],

  controllers: [
    HealthController,
    PublicController,
    AuthController,
    JobsController,
    CandidatesController,
    DocumentsController,
    ApplicationsController,
    InterviewsController,
    OffersController,
    OnboardingController,
    DashboardController,
    ReportsController,
    NotificationsController,
    AdminController,
  ],

  providers: [
    AuthService,
    AuditService,
    NotificationsService,
    JobsService,
    CandidatesService,
    DocumentsService,
    ApplicationsService,
    InterviewsService,
    OffersService,
    OnboardingService,
    DashboardService,
    ReportsService,
    AdminService,
    TasksService,

    // ---- Global guards. Order matters: gateway -> authn -> authz ----
    { provide: APP_GUARD, useClass: GatewayGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route is authenticated unless explicitly marked @Public.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },

    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    // CSRF applies to cookie-authenticated state-changing requests.
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
