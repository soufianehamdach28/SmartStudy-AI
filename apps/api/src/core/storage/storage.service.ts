import {
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { Env } from '../config/env.js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = this.config.get('S3_BUCKET', { infer: true });

    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const region = this.config.get('S3_REGION', { infer: true });
    const accessKeyId = this.config.get('S3_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY', { infer: true });
    const forcePathStyle = this.config.get('S3_FORCE_PATH_STYLE', { infer: true });

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucketExists();
      this.logger.log(`Object storage initialized for bucket: ${this.bucket}`);
    } catch (err) {
      // In tests or offline dev, log a warning instead of crashing on startup
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not verify S3 bucket "${this.bucket}": ${message}`);
    }
  }

  /**
   * Verify the target bucket exists, creating it if it does not.
   */
  async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err: unknown) {
      const isNotFound =
        err && typeof err === 'object' && ('name' in err || '$metadata' in err)
          ? (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name === 'NotFound' ||
            (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
          : false;

      if (isNotFound) {
        this.logger.log(`Bucket "${this.bucket}" does not exist; creating it.`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } else {
        throw err;
      }
    }
  }

  /**
   * Upload an object into the storage bucket.
   */
  async upload(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Retrieve an object as a Readable stream for memory-efficient processing.
   */
  async getStream(key: string): Promise<Readable> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`S3 object body is empty for key: ${key}`);
    }

    return response.Body as Readable;
  }

  /**
   * Retrieve an object entirely as a Buffer.
   */
  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Delete an object from the storage bucket.
   * S3 DeleteObject is idempotent: it succeeds even if the key does not exist.
   */
  async delete(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * Check whether an object exists in the storage bucket.
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err: unknown) {
      const isNotFound =
        err && typeof err === 'object' && ('name' in err || '$metadata' in err)
          ? (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name === 'NotFound' ||
            (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
          : false;

      if (isNotFound) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Generate an isolated, tamper-proof storage key for a user document.
   * Example output: "123e4567-e89b-12d3-a456-426614174000/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.pdf"
   */
  generateStorageKey(userId: string, extension: string): string {
    const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
    return `${userId}/${randomUUID()}${cleanExt}`;
  }

  /**
   * Expose the underlying S3Client instance if lower-level commands are required.
   */
  getClient(): S3Client {
    return this.s3Client;
  }
}
