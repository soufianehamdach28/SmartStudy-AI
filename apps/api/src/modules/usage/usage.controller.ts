import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UsageQuotaResponse } from '@smartstudy/shared';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import { UsageService } from './usage.service.js';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  async getUsage(@CurrentUser('id') userId: string): Promise<UsageQuotaResponse> {
    return this.usageService.getUsageQuota(userId);
  }
}
