import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/auth/decorators';

/**
 * Health endpoints used by Docker, Kong upstream checks and operators.
 * These reveal liveness only -- never version numbers, connection
 * strings or any other detail useful to an attacker.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (verifies the database round-trips)' })
  async readiness() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        latencyMs: Date.now() - started,
      };
    } catch {
      // No driver detail in the response body.
      return { status: 'degraded', database: 'unavailable' };
    }
  }
}
