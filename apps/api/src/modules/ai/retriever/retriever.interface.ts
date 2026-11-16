/**
 * A document chunk retrieved for grounding AI responses.
 */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  page: number;
  text: string;
  score: number;
}

/**
 * Interface for retrieving relevant chunks from a document.
 * Implementations can use PostgreSQL full-text search, pgvector embeddings, or hybrid search.
 */
export interface Retriever {
  /**
   * Retrieves the top relevant chunks for a given query within a specific document.
   *
   * @param documentId - The ID of the document to search within.
   * @param query - The search query (e.g. user question).
   * @param limit - Maximum number of chunks to return (default 5).
   * @returns Array of retrieved chunks ordered by relevance.
   */
  retrieve(
    documentId: string,
    query: string,
    limit?: number,
  ): Promise<RetrievedChunk[]>;
}
