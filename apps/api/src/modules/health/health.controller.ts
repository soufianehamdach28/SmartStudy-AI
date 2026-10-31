import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Full health report. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.database.check()]);
  }

  /** Liveness: the process is up. Never touches dependencies. */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** Readiness: the API can serve traffic (database reachable). */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.database.check()]);
  }
}
