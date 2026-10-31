import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/**
 * Readiness check: proves the API can actually query PostgreSQL.
 * A `SELECT 1` is the cheapest reliable round-trip.
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  check(timeoutMs = 2_000) {
    return this.healthIndicatorService
      .check('database')
      .attempt(() => this.prisma.$queryRaw`SELECT 1`)
      .withTimeout(timeoutMs);
  }
}
