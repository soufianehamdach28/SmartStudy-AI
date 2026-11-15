import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsageKind, UsageQuotaResponse } from '@smartstudy/shared';
import type { Env } from '../../core/config/env.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { QuotaExceededException } from './usage.exceptions.js';

export interface RecordUsageInput {
  userId: string;
  kind: UsageKind;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  costEstimate?: number;
  status?: 'SUCCESS' | 'FAILED';
  latencyMs?: number;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  /**
   * Check whether a user has remaining AI request quota for today and this month.
   * Throws QuotaExceededException if exceeded.
   */
  async checkQuota(userId: string): Promise<void> {
    const dailyLimit = this.configService.get<number>('QUOTA_AI_REQUESTS_PER_DAY', { infer: true }) ?? 20;
    const monthlyLimit = this.configService.get<number>('QUOTA_AI_REQUESTS_PER_MONTH', { infer: true }) ?? 300;

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.prisma.usageRecord.count({
        where: {
          userId,
          status: 'SUCCESS',
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.usageRecord.count({
        where: {
          userId,
          status: 'SUCCESS',
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    if (dailyUsed >= dailyLimit) {
      this.logger.warn(`User ${userId} exceeded daily AI quota (${dailyUsed}/${dailyLimit})`);
      throw new QuotaExceededException('Daily AI quota reached.', {
        dailyLimit,
        dailyUsed,
        dailyRemaining: 0,
      });
    }

    if (monthlyUsed >= monthlyLimit) {
      this.logger.warn(`User ${userId} exceeded monthly AI quota (${monthlyUsed}/${monthlyLimit})`);
      throw new QuotaExceededException('Monthly AI quota reached.', {
        monthlyLimit,
        monthlyUsed,
        monthlyRemaining: 0,
      });
    }
  }

  /**
   * Log an AI usage telemetry record in the database.
   */
  async recordUsage(input: RecordUsageInput): Promise<void> {
    try {
      await this.prisma.usageRecord.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          provider: input.provider,
          model: input.model,
          tokensIn: input.tokensIn ?? 0,
          tokensOut: input.tokensOut ?? 0,
          costEstimate: input.costEstimate ?? 0.0,
          status: input.status ?? 'SUCCESS',
          latencyMs: input.latencyMs ?? 0,
        },
      });
    } catch (error) {
      // Never crash user workflows if logging usage fails
      this.logger.error(`Failed to record AI usage for user ${input.userId}:`, error);
    }
  }

  /**
   * Return the current quota consumption and remaining allowance for a student.
   */
  async getUsageQuota(userId: string): Promise<UsageQuotaResponse> {
    const dailyLimit = this.configService.get<number>('QUOTA_AI_REQUESTS_PER_DAY', { infer: true }) ?? 20;
    const monthlyLimit = this.configService.get<number>('QUOTA_AI_REQUESTS_PER_MONTH', { infer: true }) ?? 300;

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.prisma.usageRecord.count({
        where: {
          userId,
          status: 'SUCCESS',
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.usageRecord.count({
        where: {
          userId,
          status: 'SUCCESS',
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      dailyLimit,
      dailyUsed,
      dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
      monthlyLimit,
      monthlyUsed,
      monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
    };
  }
}
