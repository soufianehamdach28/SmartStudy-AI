import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type { Env } from '../config/env.js';
import { StorageService } from './storage.service.js';

describe('StorageService', () => {
  let service: StorageService;
  let mockConfig: ConfigService<Env, true>;
  let sendMock: ReturnType<typeof vi.fn<(args?: unknown) => Promise<unknown>>>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      get: vi.fn((key: string) => {
        const configMap: Record<string, unknown> = {
          S3_BUCKET: 'test-bucket',
          S3_ENDPOINT: 'http://localhost:8333',
          S3_REGION: 'auto',
          S3_ACCESS_KEY_ID: 'test-key',
          S3_SECRET_ACCESS_KEY: 'test-secret',
          S3_FORCE_PATH_STYLE: true,
        };
        return configMap[key];
      }),
    } as unknown as ConfigService<Env, true>;

    service = new StorageService(mockConfig);

    sendMock = vi.fn<(args?: unknown) => Promise<unknown>>();
    vi.spyOn(service.getClient(), 'send').mockImplementation(sendMock as any);
  });

  describe('generateStorageKey', () => {
    it('creates key with userId, uuid and clean extension', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const key1 = service.generateStorageKey(userId, 'pdf');
      const key2 = service.generateStorageKey(userId, '.pdf');

      expect(key1).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`));
      expect(key2).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`));
      expect(key1).not.toBe(key2);
    });
  });

  describe('upload', () => {
    it('sends PutObjectCommand with correct bucket, key, and content type', async () => {
      sendMock.mockResolvedValueOnce({});
      const content = Buffer.from('hello world');

      await service.upload('test/doc.txt', content, 'text/plain');

      expect(sendMock).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      const command = sendMock.mock.calls[0][0] as PutObjectCommand;
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'test/doc.txt',
        Body: content,
        ContentType: 'text/plain',
      });
    });
  });

  describe('getStream', () => {
    it('returns Body stream from GetObjectCommand', async () => {
      const mockStream = Readable.from(['chunk1', 'chunk2']);
      sendMock.mockResolvedValueOnce({ Body: mockStream });

      const stream = await service.getStream('test/doc.txt');

      expect(sendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(stream).toBe(mockStream);
    });

    it('throws error if Body is undefined', async () => {
      sendMock.mockResolvedValueOnce({ Body: undefined });

      await expect(service.getStream('missing.txt')).rejects.toThrow(
        'S3 object body is empty for key: missing.txt',
      );
    });
  });

  describe('getBuffer', () => {
    it('collects stream chunks into a single buffer', async () => {
      const stream = Readable.from([Buffer.from('part1'), Buffer.from('part2')]);
      sendMock.mockResolvedValueOnce({ Body: stream });

      const buffer = await service.getBuffer('test/doc.txt');
      expect(buffer.toString('utf-8')).toBe('part1part2');
    });
  });

  describe('delete', () => {
    it('sends DeleteObjectCommand with bucket and key', async () => {
      sendMock.mockResolvedValueOnce({});

      await service.delete('test/doc.txt');

      expect(sendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
      const command = sendMock.mock.calls[0][0] as DeleteObjectCommand;
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'test/doc.txt',
      });
    });
  });

  describe('exists', () => {
    it('returns true when HeadObjectCommand succeeds', async () => {
      sendMock.mockResolvedValueOnce({});

      const exists = await service.exists('test/doc.txt');
      expect(exists).toBe(true);
      expect(sendMock).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it('returns false when HeadObjectCommand throws 404 or NotFound', async () => {
      const error = new Error('NotFound');
      error.name = 'NotFound';
      (error as any).$metadata = { httpStatusCode: 404 };
      sendMock.mockRejectedValueOnce(error);

      const exists = await service.exists('test/doc.txt');
      expect(exists).toBe(false);
    });

    it('re-throws error for unexpected failure', async () => {
      sendMock.mockRejectedValueOnce(new Error('Internal Server Error'));

      await expect(service.exists('test/doc.txt')).rejects.toThrow(
        'Internal Server Error',
      );
    });
  });

  describe('ensureBucketExists', () => {
    it('does not call CreateBucketCommand if bucket already exists', async () => {
      sendMock.mockResolvedValueOnce({});

      await service.ensureBucketExists();

      expect(sendMock).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
      expect(sendMock).not.toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    });

    it('calls CreateBucketCommand if bucket is not found (404)', async () => {
      const error = new Error('NotFound');
      error.name = 'NotFound';
      (error as any).$metadata = { httpStatusCode: 404 };
      sendMock.mockRejectedValueOnce(error);
      sendMock.mockResolvedValueOnce({});

      await service.ensureBucketExists();

      expect(sendMock).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
      expect(sendMock).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
      const createCommand = sendMock.mock.calls[1][0] as CreateBucketCommand;
      expect(createCommand.input).toEqual({ Bucket: 'test-bucket' });
    });

    it('re-throws error on non-404 failure', async () => {
      sendMock.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.ensureBucketExists()).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
