import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { UsageQuotaResponse } from '@smartstudy/shared';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import { UsageService } from './usage.service.js';

@ApiTags('Usage & Quotas')
@ApiBearerAuth('JWT-auth')
@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @ApiOperation({
    summary: 'Get daily and monthly AI request usage and remaining quotas',
  })
  @ApiResponse({
    status: 200,
    description: 'Current AI usage statistics and remaining quota allowances.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  async getUsage(@CurrentUser() user: CurrentUserPayload): Promise<UsageQuotaResponse> {
    return this.usageService.getUsageQuota(user.userId);
  }
}
