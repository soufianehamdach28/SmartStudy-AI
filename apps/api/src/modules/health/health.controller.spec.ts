import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import type { DatabaseHealthIndicator } from './database.health.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealth: HealthCheckService;
  let mockDatabase: DatabaseHealthIndicator;

  beforeEach(() => {
    mockHealth = {
      check: vi.fn().mockImplementation(async (indicators: Array<() => any>) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        const info = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        return {
          status: 'ok',
          info,
          error: {},
          details: info,
        };
      }),
    } as unknown as HealthCheckService;

    mockDatabase = {
      check: vi.fn().mockResolvedValue({ database: { status: 'up' } }),
    } as unknown as DatabaseHealthIndicator;

    controller = new HealthController(mockHealth, mockDatabase);
  });

  it('runs full health check including database indicator', async () => {
    const res = await controller.check();
    expect(mockHealth.check).toHaveBeenCalledTimes(1);
    expect(mockDatabase.check).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
  });

  it('runs liveness probe without external dependency calls', async () => {
    const res = await controller.live();
    expect(mockHealth.check).toHaveBeenCalledTimes(1);
    expect(mockDatabase.check).not.toHaveBeenCalled();
    expect(res.status).toBe('ok');
  });

  it('runs readiness probe verifying database connectivity', async () => {
    const res = await controller.ready();
    expect(mockHealth.check).toHaveBeenCalledTimes(1);
    expect(mockDatabase.check).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
  });
});
