import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../core/prisma/prisma.service.js';
import {
  DEFAULT_RETRIEVER_LIMIT,
  MAX_RETRIEVER_LIMIT,
  PostgresRetrieverService,
} from './postgres-retriever.service.js';

describe('PostgresRetrieverService', () => {
  let service: PostgresRetrieverService;
  let prismaMock: {
    $queryRaw: ReturnType<typeof vi.fn>;
    documentChunk: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const documentId = 'doc-123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    prismaMock = {
      $queryRaw: vi.fn(),
      documentChunk: {
        findMany: vi.fn(),
      },
    };

    service = new PostgresRetrieverService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('returns ranked chunks when full-text search matches', async () => {
    const rawMatches = [
      {
        id: 'chunk-1',
        documentId,
        page: 2,
        text: 'Photosynthesis is the process by which plants use sunlight.',
        score: '0.607927',
      },
      {
        id: 'chunk-2',
        documentId,
        page: 3,
        text: 'Chlorophyll absorbs light energy for photosynthesis.',
        score: 0.4215,
      },
    ];
    prismaMock.$queryRaw.mockResolvedValueOnce(rawMatches);

    const result = await service.retrieve(documentId, 'photosynthesis plants');

    expect(result).toEqual([
      {
        id: 'chunk-1',
        documentId,
        page: 2,
        text: 'Photosynthesis is the process by which plants use sunlight.',
        score: 0.607927,
      },
      {
        id: 'chunk-2',
        documentId,
        page: 3,
        text: 'Chlorophyll absorbs light energy for photosynthesis.',
        score: 0.4215,
      },
    ]);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentChunk.findMany).not.toHaveBeenCalled();
  });

  it('falls back to sequential chunks when full-text search returns 0 results', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    const fallbackChunks = [
      {
        id: 'chunk-1',
        documentId,
        page: 1,
        text: 'Chapter 1: Introduction to Biology',
      },
      {
        id: 'chunk-2',
        documentId,
        page: 1,
        text: 'Overview of living organisms.',
      },
    ];
    prismaMock.documentChunk.findMany.mockResolvedValueOnce(fallbackChunks);

    const result = await service.retrieve(documentId, 'what is this?');

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: { documentId },
      orderBy: { index: 'asc' },
      take: DEFAULT_RETRIEVER_LIMIT,
      select: {
        id: true,
        documentId: true,
        page: true,
        text: true,
      },
    });
    expect(result).toEqual([
      {
        id: 'chunk-1',
        documentId,
        page: 1,
        text: 'Chapter 1: Introduction to Biology',
        score: 0,
      },
      {
        id: 'chunk-2',
        documentId,
        page: 1,
        text: 'Overview of living organisms.',
        score: 0,
      },
    ]);
  });

  it('skips FTS and immediately uses fallback chunks when query is empty or whitespace', async () => {
    const fallbackChunks = [
      {
        id: 'chunk-1',
        documentId,
        page: 1,
        text: 'Chapter 1: Introduction to Biology',
      },
    ];
    prismaMock.documentChunk.findMany.mockResolvedValueOnce(fallbackChunks);

    const result = await service.retrieve(documentId, '   ');

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: { documentId },
      orderBy: { index: 'asc' },
      take: DEFAULT_RETRIEVER_LIMIT,
      select: {
        id: true,
        documentId: true,
        page: true,
        text: true,
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.score).toBe(0);
  });

  it('gracefully falls back to initial chunks if $queryRaw throws an error', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(
      new Error('database connection dropped'),
    );
    const fallbackChunks = [
      {
        id: 'chunk-fallback',
        documentId,
        page: 1,
        text: 'Fallback text content',
      },
    ];
    prismaMock.documentChunk.findMany.mockResolvedValueOnce(fallbackChunks);

    const result = await service.retrieve(documentId, 'mitochondria');

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: 'chunk-fallback',
        documentId,
        page: 1,
        text: 'Fallback text content',
        score: 0,
      },
    ]);
  });

  it('clamps limit between 1 and MAX_RETRIEVER_LIMIT (10)', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    // Limit <= 0 should clamp to 1
    await service.retrieve(documentId, 'query', -5);
    expect(prismaMock.documentChunk.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    );

    // Limit > MAX_RETRIEVER_LIMIT (10) should clamp to 10
    await service.retrieve(documentId, 'query', 99);
    expect(prismaMock.documentChunk.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: MAX_RETRIEVER_LIMIT }),
    );

    // Floating limit should be floored
    await service.retrieve(documentId, 'query', 4.8);
    expect(prismaMock.documentChunk.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 4 }),
    );
  });
});
