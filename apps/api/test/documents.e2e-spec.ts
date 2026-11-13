import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  apiErrorSchema,
  documentResponseSchema,
  documentUploadResponseSchema,
  paginatedDocumentsResponseSchema,
} from '@smartstudy/shared';
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

  const otherUser = {
    email: `e2e-docs-other-${Date.now()}@example.com`,
    password: 'Password123!',
  };

  let accessToken: string;
  let userId: string;
  let otherAccessToken: string;
  let otherUserId: string;
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

    // Register second user for IDOR testing
    const otherRegisterRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(otherUser)
      .expect(201);

    otherAccessToken = otherRegisterRes.body.tokens.accessToken;
    otherUserId = otherRegisterRes.body.user.id;
  });

  afterAll(async () => {
    // Small pause to allow background workers to finish in-flight jobs cleanly
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up uploaded objects in S3
    for (const key of createdStorageKeys) {
      try {
        await storage.delete(key);
      } catch {
        // Ignore cleanup deletion errors
      }
    }

    // Clean up users and cascading records in PostgreSQL
    const userIds = [userId, otherUserId].filter(Boolean);
    await prisma.document.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
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
      expect(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']).toContain(
        dbDoc?.status,
      );
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
      expect(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']).toContain(
        dbDoc?.status,
      );
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

  describe('GET /api/documents', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/api/documents').expect(401);
    });

    it('returns paginated list of documents belonging only to current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const parsed = paginatedDocumentsResponseSchema.parse(res.body);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(parsed.items)).toBe(true);

      // Verify every returned document belongs to caller
      for (const item of parsed.items) {
        expect(item.userId).toBe(userId);
      }
    });

    it('returns empty list for a user with no documents', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(200);

      const parsed = paginatedDocumentsResponseSchema.parse(res.body);
      expect(parsed.items).toHaveLength(0);
      expect(parsed.total).toBe(0);
      expect(parsed.totalPages).toBe(0);
    });

    it('rejects query with limit exceeding 50 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents?limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/documents/:id', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/documents/7c86fc98-0bf6-4ddb-b337-8765b61dc8a1')
        .expect(401);
    });

    it('returns 400 Bad Request when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 NOT_FOUND for non-existent document UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents/7c86fc98-0bf6-4ddb-b337-8765b61dc8a1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('NOT_FOUND');
    });

    it('returns document details when caller is the owner', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const docId = listRes.body.items[0].id;

      const res = await request(app.getHttpServer())
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const parsed = documentResponseSchema.parse(res.body);
      expect(parsed.id).toBe(docId);
      expect(parsed.userId).toBe(userId);
    });

    it('returns 404 NOT_FOUND when accessing another users document (IDOR protection)', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const docId = listRes.body.items[0].id;

      // otherUser attempts to access user's document
      const res = await request(app.getHttpServer())
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(404);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .delete('/api/documents/7c86fc98-0bf6-4ddb-b337-8765b61dc8a1')
        .expect(401);
    });

    it('returns 400 Bad Request when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/documents/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 NOT_FOUND when deleting non-existent document', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/documents/7c86fc98-0bf6-4ddb-b337-8765b61dc8a1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NOT_FOUND when trying to delete another users document (IDOR protection)', async () => {
      // Create a fresh doc for user
      const txt = Buffer.from('Document to protect against other users');
      const uploadRes = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', txt, 'protected.txt')
        .expect(202);

      const docId = uploadRes.body.document.id;

      // otherUser attempts to delete it
      const res = await request(app.getHttpServer())
        .delete(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(404);

      const parsed = apiErrorSchema.parse(res.body);
      expect(parsed.error.code).toBe('NOT_FOUND');

      // Verify doc still exists in DB
      const dbDoc = await prisma.document.findUnique({ where: { id: docId } });
      expect(dbDoc).not.toBeNull();
      if (dbDoc?.storageKey) {
        createdStorageKeys.push(dbDoc.storageKey);
      }
    });

    it('deletes document, cascades chunks in DB, and removes S3 file when owner deletes it (204)', async () => {
      // Upload a new document to delete
      const txt = Buffer.from('Temporary document for deletion test');
      const uploadRes = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', txt, 'to-delete.txt')
        .expect(202);

      const docId = uploadRes.body.document.id;

      // Verify it exists in DB and S3
      const dbDocBefore = await prisma.document.findUnique({ where: { id: docId } });
      expect(dbDocBefore).not.toBeNull();
      const storageKey = dbDocBefore!.storageKey;

      const existsBefore = await storage.exists(storageKey);
      expect(existsBefore).toBe(true);

      // Delete endpoint returns 204 No Content
      await request(app.getHttpServer())
        .delete(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify removed from DB
      const dbDocAfter = await prisma.document.findUnique({ where: { id: docId } });
      expect(dbDocAfter).toBeNull();

      // Verify chunks removed (cascaded)
      const chunksAfter = await prisma.documentChunk.findMany({ where: { documentId: docId } });
      expect(chunksAfter).toHaveLength(0);

      // Verify removed from S3
      const existsAfter = await storage.exists(storageKey);
      expect(existsAfter).toBe(false);
    });
  });
});
