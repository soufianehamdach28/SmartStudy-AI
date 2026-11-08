import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

/**
 * Global storage module providing access to S3-compatible object storage
 * (SeaweedFS locally, Cloudflare R2 / S3 in production).
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
