import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseHealthIndicator } from './database.health.js';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Full health report. */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Full system health status report' })
  @ApiResponse({
    status: 200,
    description: 'System is healthy and dependencies are reachable.',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more required subsystem checks failed.',
  })
  check() {
    return this.health.check([() => this.database.check()]);
  }

  /** Liveness: the process is up. Never touches dependencies. */
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe (process is running)' })
  @ApiResponse({ status: 200, description: 'Application process is alive.' })
  live() {
    return this.health.check([]);
  }

  /** Readiness: the API can serve traffic (database reachable). */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe (verifies database connectivity)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready to accept traffic.',
  })
  @ApiResponse({
    status: 503,
    description: 'Database is not reachable.',
  })
  ready() {
    return this.health.check([() => this.database.check()]);
  }
}
