import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageController } from './usage.controller.js';
import type { UsageService } from './usage.service.js';

describe('UsageController', () => {
  let controller: UsageController;
  let usageServiceMock: {
    getUsageQuota: ReturnType<typeof vi.fn>;
  };

  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    usageServiceMock = {
      getUsageQuota: vi.fn(),
    };

    controller = new UsageController(usageServiceMock as unknown as UsageService);
  });

  it('delegates to usageService.getUsageQuota and returns quota details', async () => {
    const mockQuota = {
      dailyLimit: 20,
      dailyUsed: 3,
      dailyRemaining: 17,
      monthlyLimit: 300,
      monthlyUsed: 25,
      monthlyRemaining: 275,
    };

    usageServiceMock.getUsageQuota.mockResolvedValue(mockQuota);

    const result = await controller.getUsage(userId);

    expect(usageServiceMock.getUsageQuota).toHaveBeenCalledWith(userId);
    expect(result).toEqual(mockQuota);
  });
});
