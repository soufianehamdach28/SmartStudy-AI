import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './core/common/filters/global-exception.filter.js';
import { AppThrottlerGuard } from './core/common/guards/app-throttler.guard.js';
import { type Env, parseEnv } from './core/config/env.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { QueueModule } from './core/queue/queue.module.js';
import { StorageModule } from './core/storage/storage.module.js';
import { LlmModule } from './core/llm/llm.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { UsageModule } from './modules/usage/usage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // The API runs from apps/api, while the monorepo keeps a single .env at
      // the root. Real environment variables always win over these files.
      envFilePath: ['.env', '../../.env'],
      validate: (config) => parseEnv(config),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const ttlSeconds = config.get('RATE_LIMIT_TTL_SECONDS', { infer: true });
        const limit = config.get('RATE_LIMIT_MAX', { infer: true });
        return {
          errorMessage: 'Too many requests. Please slow down and try again later.',
          throttlers: [
            {
              name: 'default',
              ttl: seconds(ttlSeconds),
              limit,
            },
          ],
        };
      },
    }),
    PrismaModule,
    QueueModule,
    StorageModule,
    LlmModule,
    HealthModule,
    AuthModule,
    DocumentsModule,
    UsageModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}

