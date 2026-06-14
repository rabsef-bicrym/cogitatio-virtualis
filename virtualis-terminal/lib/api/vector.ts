// cogitatio-virtualis/virtualis-terminal/lib/api/vector.ts
//
// Vector search backed by Postgres + pgvector, replacing the FastAPI/FAISS
// service that previously ran alongside the app. The corpus is published to
// the database by cogitatio-server's publish script; this module only reads.
//
// Score parity with the old backend: FAISS used IndexFlatIP over normalized
// Voyage embeddings and reported `1 - inner_product`, which is exactly
// pgvector's cosine-distance operator (`<=>`), so scores and ordering are
// unchanged.

import { DocumentType } from "@/types/documents";
import type {
  SearchRequest,
  SearchResult,
  DocumentResponse,
} from "@/types/documents";
import {
  parseDocumentResponses,
  parseSearchResults,
} from "@/lib/api/document-codec";
import { getVectorPool } from "@/lib/api/vector-db";
import { embedText, type VoyageInputType } from "@/lib/api/voyage";

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

interface ChunkRow {
  doc_id: string;
  chunk_id: string;
  content: string;
  metadata: Record<string, unknown>;
}

function toDocumentRow(row: ChunkRow) {
  return {
    doc_id: row.doc_id,
    chunk_id: row.chunk_id,
    total_chunks: Number(row.metadata?.total_chunks ?? 1),
    content: row.content,
    metadata: row.metadata,
  };
}

export class VectorAPI {
  private async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const result = await getVectorPool().query(sql, params);
      return result.rows as T[];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Vector store query failed";
      throw new APIError(message, 500);
    }
  }

  async healthCheck(): Promise<{ status: string }> {
    await this.query("SELECT 1");
    return { status: "healthy" };
  }

  async getStats(): Promise<{
    total_vectors: number;
    total_documents: number;
    vectors_in_metadata: number;
    dimension: number;
    index_size_mb: number;
  }> {
    const [row] = await this.query<{
      total_vectors: number;
      total_documents: number;
      dimension: number | null;
      size_bytes: string;
    }>(
      `SELECT
         count(*)::int AS total_vectors,
         count(DISTINCT doc_id)::int AS total_documents,
         (SELECT vector_dims(embedding) FROM vector_chunks LIMIT 1) AS dimension,
         pg_total_relation_size('vector_chunks')::text AS size_bytes
       FROM vector_chunks`,
    );

    return {
      total_vectors: row.total_vectors,
      total_documents: row.total_documents,
      vectors_in_metadata: row.total_vectors,
      dimension: row.dimension ?? 0,
      index_size_mb: Number(row.size_bytes) / (1024 * 1024),
    };
  }

  async getRandomTexts(count: number = 5): Promise<{ texts: string[] }> {
    if (count < 1 || count > 20)
      throw new Error("Count must be between 1 and 20");

    const rows = await this.query<{ content: string }>(
      "SELECT content FROM vector_chunks ORDER BY random() LIMIT $1",
      [count],
    );
    return { texts: rows.map((row) => row.content).filter(Boolean) };
  }

  async getDocument(docId: string): Promise<DocumentResponse[]> {
    const rows = await this.query<ChunkRow>(
      `SELECT doc_id, chunk_id, content, metadata
       FROM vector_chunks
       WHERE doc_id = $1
       ORDER BY (metadata->>'chunk_index')::int`,
      [docId],
    );

    if (rows.length === 0) {
      throw new APIError(`Document '${docId}' not found.`, 404);
    }
    return parseDocumentResponses(rows.map(toDocumentRow));
  }

  async getDocumentsByType(
    docType: DocumentType,
    options?: {
      project_subtype?: string;
      other_subtype?: string;
    },
  ): Promise<DocumentResponse[]> {
    // Mirrors the old API's validation: subtypes only apply to their type.
    if (docType === DocumentType.PROJECT && options?.other_subtype) {
      throw new APIError(
        "Invalid subtype: 'other_subtype' is not applicable for 'PROJECT' documents.",
        400,
      );
    }
    if (docType === DocumentType.OTHER && options?.project_subtype) {
      throw new APIError(
        "Invalid subtype: 'project_subtype' is not applicable for 'OTHER' documents.",
        400,
      );
    }

    const params: unknown[] = [docType];
    let sql = `SELECT doc_id, chunk_id, content, metadata
               FROM vector_chunks
               WHERE metadata->>'type' = $1`;

    const subtype =
      docType === DocumentType.PROJECT
        ? options?.project_subtype
        : docType === DocumentType.OTHER
          ? options?.other_subtype
          : undefined;
    if (subtype) {
      params.push(subtype);
      sql += " AND metadata->>'sub_type' = $2";
    }

    const rows = await this.query<ChunkRow>(sql, params);
    return parseDocumentResponses(rows.map(toDocumentRow));
  }

  async search(request: SearchRequest): Promise<SearchResult[]> {
    if (!["none", "query", "document"].includes(request.embedding_type)) {
      throw new Error(`Invalid embedding_type: ${request.embedding_type}`);
    }

    const embedding = await embedText(
      request.query,
      request.embedding_type as VoyageInputType,
    );
    const vectorLiteral = `[${embedding.join(",")}]`;
    const k = request.k ?? 5;
    const filterTypes = request.filter_types ?? [];

    const params: unknown[] = [vectorLiteral, k];
    let filterClause = "";
    if (filterTypes.length > 0) {
      params.push(filterTypes);
      filterClause = "WHERE metadata->>'type' = ANY($3)";
    }

    const rows = await this.query<ChunkRow & { score: number }>(
      `SELECT doc_id, chunk_id, content, metadata,
              (embedding <=> $1::vector)::float8 AS score
       FROM vector_chunks
       ${filterClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      params,
    );

    return parseSearchResults(
      rows.map((row) => ({
        doc_id: row.doc_id,
        chunk_id: row.chunk_id,
        score: row.score,
        content: row.content,
        metadata: row.metadata,
      })),
    );
  }
}

export const vectorApi = new VectorAPI();
