import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnv } from './core/config/env.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

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
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
