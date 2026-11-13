import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { StorageService } from '../src/core/storage/storage.service.js';

function createPdfWithText(text: string): Buffer {
  const content = `BT /F1 18 Tf 100 100 Td (${text}) Tj ET`;
  const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const pdfStr = [
    '%PDF-1.4',
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj',
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj',
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R>> endobj',
    '4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj',
    '5 0 obj ' + stream + ' endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    'trailer <</Size 6 /Root 1 0 R>>',
    'startxref',
    '500',
    '%%EOF',
  ].join('\n');
  return Buffer.from(pdfStr);
}

function createBlankPdf(): Buffer {
  const pdfStr = [
    '%PDF-1.4',
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj',
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj',
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>>>> endobj',
    'xref',
    '0 4',
    '0000000000 65535 f ',
    'trailer <</Size 4 /Root 1 0 R>>',
    'startxref',
    '250',
    '%%EOF',
  ].join('\n');
  return Buffer.from(pdfStr);
}

async function waitForDocumentStatus(
  prisma: PrismaService,
  documentId: string,
  timeoutMs = 15000,
): Promise<{ status: string; errorMessage: string | null; pageCount: number | null }> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { status: true, errorMessage: true, pageCount: true },
    });
    if (doc && (doc.status === 'READY' || doc.status === 'FAILED')) {
      return doc;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for document ${documentId} processing`);
}

describe('Document Processing Worker (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;

  const testUser = {
    email: `worker-e2e-${Date.now()}@example.com`,
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

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    accessToken = registerRes.body.tokens.accessToken;
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    for (const key of createdStorageKeys) {
      try {
        await storage.delete(key);
      } catch {
        // Ignore S3 deletion errors during teardown
      }
    }

    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    await app.close();
  });

  it('processes uploaded TXT file into chunks and updates status to READY', async () => {
    const content = Buffer.from(
      'Quantum mechanics describes the physical properties of nature at atomic scale.\n\n' +
        'Wave-particle duality is a central concept where matter exhibits both wave and particle characteristics.',
    );

    const res = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', content, 'quantum-physics.txt')
      .expect(202);

    const documentId = res.body.document.id;

    // Track storage key for cleanup
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (doc?.storageKey) createdStorageKeys.push(doc.storageKey);

    // Wait for the background worker to finish
    const finalDoc = await waitForDocumentStatus(prisma, documentId);
    expect(finalDoc.status).toBe('READY');
    expect(finalDoc.pageCount).toBe(1);
    expect(finalDoc.errorMessage).toBeNull();

    // Verify chunks were created
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].text).toContain('Quantum mechanics describes');

    // Verify full-text search index (tsv column) works
    const searchResults: any[] = await prisma.$queryRaw`
      SELECT id, "documentId", page, text
      FROM "document_chunks"
      WHERE "documentId" = ${documentId}
        AND tsv @@ plainto_tsquery('english', 'quantum')
    `;

    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].text).toContain('Quantum mechanics');
  });

  it('processes uploaded PDF file with text layer into chunks and updates status to READY', async () => {
    const pdfBuffer = createPdfWithText('Mitochondria is the powerhouse of the cell.');

    const res = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', pdfBuffer, 'biology-notes.pdf')
      .expect(202);

    const documentId = res.body.document.id;

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (doc?.storageKey) createdStorageKeys.push(doc.storageKey);

    const finalDoc = await waitForDocumentStatus(prisma, documentId);
    expect(finalDoc.status).toBe('READY');
    expect(finalDoc.pageCount).toBe(1);
    expect(finalDoc.errorMessage).toBeNull();

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].text).toContain('Mitochondria is the powerhouse');
  });

  it('marks document as FAILED when PDF has no text layer (scanned/blank PDF)', async () => {
    const blankPdf = createBlankPdf();

    const res = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', blankPdf, 'scanned-document.pdf')
      .expect(202);

    const documentId = res.body.document.id;

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (doc?.storageKey) createdStorageKeys.push(doc.storageKey);

    const finalDoc = await waitForDocumentStatus(prisma, documentId);
    expect(finalDoc.status).toBe('FAILED');
    expect(finalDoc.errorMessage).toMatch(/Scanned PDFs without an OCR text layer/);

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
    });
    expect(chunks).toHaveLength(0);
  });
});
