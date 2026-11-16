import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { RetrievedChunk, Retriever } from './retriever.interface.js';

/**
 * Default number of chunks retrieved when not specified.
 */
export const DEFAULT_RETRIEVER_LIMIT = 5;

/**
 * Upper bound on chunks retrieved to stay within prompt token budget.
 */
export const MAX_RETRIEVER_LIMIT = 10;

/**
 * PostgreSQL full-text search retriever.
 *
 * Uses PostgreSQL's `plainto_tsquery('english', ...)` against the indexed `tsv` column
 * on `document_chunks`, ranking results with `ts_rank`. If no chunks match (e.g. out-of-vocabulary
 * query or stop words), falls back to the document's sequential initial chunks so the LLM
 * still has course context.
 */
@Injectable()
export class PostgresRetrieverService implements Retriever {
  private readonly logger = new Logger(PostgresRetrieverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves relevant chunks for a question within a document.
   */
  async retrieve(
    documentId: string,
    query: string,
    limit: number = DEFAULT_RETRIEVER_LIMIT,
  ): Promise<RetrievedChunk[]> {
    const safeLimit = Math.min(
      Math.max(1, Math.floor(limit || DEFAULT_RETRIEVER_LIMIT)),
      MAX_RETRIEVER_LIMIT,
    );

    const cleanQuery = query?.trim() ?? '';
    if (cleanQuery.length === 0) {
      this.logger.debug(
        `Empty query for document "${documentId}", using fallback chunks`,
      );
      return this.fallbackChunks(documentId, safeLimit);
    }

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          documentId: string;
          page: number;
          text: string;
          score: number | string;
        }>
      >`
        SELECT
          id,
          "documentId",
          page,
          text,
          ts_rank(tsv, plainto_tsquery('english', ${cleanQuery})) AS score
        FROM "document_chunks"
        WHERE "documentId" = ${documentId}
          AND tsv @@ plainto_tsquery('english', ${cleanQuery})
        ORDER BY score DESC, page ASC, index ASC
        LIMIT ${safeLimit};
      `;

      if (rows && rows.length > 0) {
        return rows.map((row) => ({
          id: row.id,
          documentId: row.documentId,
          page: row.page,
          text: row.text,
          score: Number(row.score) || 0,
        }));
      }

      this.logger.debug(
        `FTS returned 0 results for query "${cleanQuery}" on document "${documentId}", using fallback chunks`,
      );
      return this.fallbackChunks(documentId, safeLimit);
    } catch (error) {
      this.logger.warn(
        `FTS query failed for document "${documentId}": ${error instanceof Error ? error.message : String(error)}. Falling back to initial chunks.`,
      );
      return this.fallbackChunks(documentId, safeLimit);
    }
  }

  /**
   * Graceful fallback: returns the first N sequential chunks of the document.
   */
  private async fallbackChunks(
    documentId: string,
    limit: number,
  ): Promise<RetrievedChunk[]> {
    const chunks = await this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
      take: limit,
      select: {
        id: true,
        documentId: true,
        page: true,
        text: true,
      },
    });

    return chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      page: chunk.page,
      text: chunk.text,
      score: 0,
    }));
  }
}
