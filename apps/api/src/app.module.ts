import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './core/common/filters/global-exception.filter.js';
import { parseEnv } from './core/config/env.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { QueueModule } from './core/queue/queue.module.js';
import { StorageModule } from './core/storage/storage.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';

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
    PrismaModule,
    QueueModule,
    StorageModule,
    HealthModule,
    AuthModule,
    DocumentsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}

