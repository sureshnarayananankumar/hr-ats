import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client.
 *
 * All data access goes through Prisma's parameterised query builder --
 * the codebase never concatenates user input into SQL. The two $queryRaw
 * call sites in the reports module use tagged templates, which Prisma
 * parameterises, so they are injection-safe by construction.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to MySQL via Prisma');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Scrubs every table except the migration journal. Test-only: it
   * refuses to run outside NODE_ENV=test so it can never be pointed at
   * a real database by accident.
   */
  async truncateAllTables(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAllTables() is only permitted when NODE_ENV=test');
    }

    const rows = await this.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'
    `;

    await this.$transaction([
      this.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
      ...rows.map((row) => this.$executeRawUnsafe(`TRUNCATE TABLE \`${row.TABLE_NAME}\``)),
      this.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
    ]);
  }
}
