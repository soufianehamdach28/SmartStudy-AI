import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { apiErrorSchema, documentUploadResponseSchema } from '@smartstudy/shared';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { StorageService } from '../src/core/storage/storage.service.js';

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;

  const testUser = {
    email: `e2e-docs-${Date.now()}@example.com`,
    password: 'Password123!',
  };

  let accessToken: string;
  let userId: string;
  const createdStorageKeys: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
      ],
    });

    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);

    // Register a dedicated user for document tests
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    accessToken = registerRes.body.tokens.accessToken;
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    // Clean up uploaded objects in S3
    for (const key of createdStorageKeys) {
      try {
        await storage.delete(key);
      } catch {
        // Ignore cleanup deletion errors
      }
    }

    // Clean up user and cascading records in PostgreSQL
    await prisma.document.deleteMany({
      where: { userId },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });

    await app.close();
  });

  describe('POST /api/documents', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .attach('file', Buffer.from('%PDF-1.4 test'), 'sample.pdf')
        .expect(401);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with no attached file with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unsupported file extension with 415 Unsupported Media Type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('hello script'), 'script.sh')
        .expect(415);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects fake PDF file without valid magic bytes with 415', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach(
          'file',
          Buffer.from('not really a pdf file content'),
          'fake.pdf',
        )
        .expect(415);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects fake TXT file containing binary bytes with 415', async () => {
      const pngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);

      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pngBytes, 'binary.txt')
        .expect(415);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('uploads a valid PDF file, stores to S3, records in DB with status UPLOADED, and returns 202', async () => {
      const pdfContent = Buffer.from(
        '%PDF-1.4\n% SmartStudy E2E Test Document\n1 0 obj\n<< /Title (Course Notes) >>\nendobj\ntrailer\n<<>>\n%%EOF',
      );

      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pdfContent, 'course-notes.pdf')
        .expect(202);

      const parsed = documentUploadResponseSchema.parse(res.body);
      expect(parsed.document.title).toBe('course-notes.pdf');
      expect(parsed.document.mimeType).toBe('application/pdf');
      expect(parsed.document.sizeBytes).toBe(pdfContent.length);
      expect(parsed.document.status).toBe('UPLOADED');
      expect(parsed.document.userId).toBe(userId);

      // Verify record exists in PostgreSQL
      const dbDoc = await prisma.document.findUnique({
        where: { id: parsed.document.id },
      });
      expect(dbDoc).toBeDefined();
      expect(dbDoc?.status).toBe('UPLOADED');
      expect(dbDoc?.storageKey).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`));

      if (dbDoc?.storageKey) {
        createdStorageKeys.push(dbDoc.storageKey);

        // Verify object exists in S3 storage and matches content
        const exists = await storage.exists(dbDoc.storageKey);
        expect(exists).toBe(true);

        const storedBuffer = await storage.getBuffer(dbDoc.storageKey);
        expect(storedBuffer).toEqual(pdfContent);
      }
    });

    it('uploads a valid TXT file, stores to S3, records in DB with status UPLOADED, and returns 202', async () => {
      const txtContent = Buffer.from(
        '# Introduction to Data Structures\n\nArrays, Linked Lists, Trees, and Graphs.\nComplexity analysis.',
      );

      const res = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', txtContent, 'algorithms.txt')
        .expect(202);

      const parsed = documentUploadResponseSchema.parse(res.body);
      expect(parsed.document.title).toBe('algorithms.txt');
      expect(parsed.document.mimeType).toBe('text/plain');
      expect(parsed.document.sizeBytes).toBe(txtContent.length);
      expect(parsed.document.status).toBe('UPLOADED');
      expect(parsed.document.userId).toBe(userId);

      // Verify record exists in PostgreSQL
      const dbDoc = await prisma.document.findUnique({
        where: { id: parsed.document.id },
      });
      expect(dbDoc).toBeDefined();
      expect(dbDoc?.status).toBe('UPLOADED');
      expect(dbDoc?.storageKey).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.txt$`));

      if (dbDoc?.storageKey) {
        createdStorageKeys.push(dbDoc.storageKey);

        // Verify object exists in S3 storage and matches content
        const exists = await storage.exists(dbDoc.storageKey);
        expect(exists).toBe(true);

        const storedBuffer = await storage.getBuffer(dbDoc.storageKey);
        expect(storedBuffer).toEqual(txtContent);
      }
    });
  });
});
