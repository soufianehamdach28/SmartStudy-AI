import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Exported globally so feature modules can inject PrismaService without
 * importing this module every time. Feature modules still must respect the
 * rule "no Prisma calls in controllers".
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
