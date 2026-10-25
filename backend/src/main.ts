import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Request bodies are JSON or multipart; raw body access is not needed.
    bodyParser: true,
  });

  const config = app.get(ConfigService);
  const isProduction = config.get<boolean>('isProduction');
  const apiPrefix = config.get<string>('apiPrefix') ?? 'api';
  const port = config.get<number>('port') ?? 3000;

  app.setGlobalPrefix(apiPrefix, {
    // Health must stay reachable at a stable path for Docker and Kong.
    exclude: [],
  });

  /**
   * Trust exactly the number of proxy hops in front of us (Kong = 1).
   *
   * Setting this to `true` would let a client spoof their IP with an
   * X-Forwarded-For header, which would poison rate limiting, lockouts
   * and the audit trail. Pinning the hop count means only the real
   * gateway hop is believed.
   */
  app.set('trust proxy', config.get<number>('security.trustProxyHops') ?? 1);

  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI needs this
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      noSniff: true,
      frameguard: { action: 'deny' },
      // Advertising the framework is free reconnaissance for an attacker.
      hidePoweredBy: true,
    }),
  );

  /**
   * CORS.
   *
   * The origin list is explicit -- a wildcard is incompatible with
   * credentialed requests and would expose every authenticated endpoint
   * to any site. Kong enforces the same list at the edge.
   */
  const corsOrigins = config.get<string[]>('security.corsOrigins') ?? [];
  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin and server-to-server calls arrive without an Origin.
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);

      // Deny WITHOUT throwing.
      //
      // Passing an Error here propagates to the exception filter and
      // surfaces a routine cross-origin denial as "500 Internal Server
      // Error", which wrongly implies the server is broken and sends
      // people debugging the wrong thing.
      //
      // Returning `false` simply omits the Access-Control-Allow-Origin
      // header. The browser then blocks the response, which is exactly
      // what CORS is meant to do, and the log line below tells an
      // operator which origin was refused.
      logger.warn(
        `Blocked cross-origin request from "${origin}". ` +
          `Permitted origins: ${corsOrigins.join(', ') || '(none configured)'}`,
      );
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip anything not declared on the DTO. This is the primary
      // mass-assignment defence: an injected "status" or "roleId" in a
      // request body is removed before it can reach a service.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Validation messages leak DTO shape; keep them in development.
      disableErrorMessages: false,
      validationError: { target: false, value: false },
    }),
  );

  // ---- OpenAPI ----
  // Published in development only; in production the spec is generated
  // into docs/ at build time rather than served from the running API.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HR ATS API')
      .setDescription(
        'HR Job Requirement Board & Applicant Tracking System.\n\n' +
          'Authentication uses HTTP-only cookies. State-changing requests ' +
          'additionally require the X-CSRF-Token header (see /api/auth/csrf).',
      )
      .setVersion('1.0')
      .addCookieAuth('hr_ats_access')
      .addBearerAuth()
      .addTag('Authentication')
      .addTag('Public Careers Portal')
      .addTag('Job Requirements')
      .addTag('Candidates')
      .addTag('Applications')
      .addTag('Documents')
      .addTag('Interviews')
      .addTag('Offers')
      .addTag('Onboarding')
      .addTag('Dashboard')
      .addTag('Reports')
      .addTag('Notifications')
      .addTag('Administration')
      .addTag('Health')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    });
    logger.log(`Swagger UI available at /${apiPrefix}/docs`);
  }

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`HR ATS API listening on port ${port} (${config.get('nodeEnv')})`);
  logger.log(`Permitted CORS origins: ${corsOrigins.join(', ') || '(none configured)'}`);
}

bootstrap().catch((error) => {
  // A boot failure is usually a bad secret or an unreachable database;
  // surface it loudly rather than exiting silently.
  new Logger('Bootstrap').error('Application failed to start', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
