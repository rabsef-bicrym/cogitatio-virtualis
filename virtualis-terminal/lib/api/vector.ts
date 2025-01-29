// cogitatio-virtualis/virtualis-terminal/lib/api/vector.ts

import type {
  DocumentType,
  SearchRequest,
  SearchResult,
  DocumentResponse,
} from '@/types/documents';
//import { searchUtils } from '@/pages/utils/docUtils';

const API_BASE = process.env.VECTOR_API_URL || 'http://127.0.0.1:8000';

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class VectorAPI {
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Unknown error' }));
      throw new APIError(
        error.detail || 'API request failed',
        response.status,
        error.code,
      );
    }

    const data: T = await response.json();
    return data;
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.fetch('/health');
  }

  async getStats(): Promise<{
    total_vectors: number;
    total_documents: number;
    vectors_in_metadata: number;
    dimension: number;
    index_size_mb: number;
  }> {
    return this.fetch('/stats');
  }

  async getRandomTexts(count: number = 5): Promise<{ texts: string[] }> {
    if (count < 1 || count > 20)
      throw new Error('Count must be between 1 and 20');

    const response = await this.fetch<{ texts: string[] }>(
      `/documents/random?${new URLSearchParams({ count: count.toString() })}`,
    );

    // console.log('Got random texts:', response);

    return response;
  }

  async getDocument(docId: string): Promise<DocumentResponse[]> {
    // Now we return doc_id, content, and metadata as DocumentResponse
    return this.fetch<DocumentResponse[]>(`/documents/${docId}`);
  }

  async getDocumentsByType(
    docType: DocumentType,
    options?: {
      project_subtype?: string;
      other_subtype?: string;
    },
  ): Promise<DocumentResponse[]> {
    const params = new URLSearchParams();
    if (options?.project_subtype)
      params.append('project_subtype', options.project_subtype);
    if (options?.other_subtype)
      params.append('other_subtype', options.other_subtype);
    const queryString = params.toString() ? `?${params}` : '';
    return this.fetch<DocumentResponse[]>(
      `/documents/type/${docType}${queryString}`,
    );
  }

  async search(request: SearchRequest): Promise<SearchResult[]> {
    if (!['none', 'query', 'document'].includes(request.embedding_type)) {
      throw new Error(`Invalid embedding_type: ${request.embedding_type}`);
    }

    const body = JSON.stringify({
      query: request.query,
      embedding_type: request.embedding_type,
      k: request.k ?? 5,
      filter_types: request.filter_types ?? [],
    });

    try {
      const result = await this.fetch<SearchResult[]>('/search', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // console.log('Fetch result:', result);

      return result;
    } catch (error) {
      console.error('Error during fetch:', error);
      throw error;
    }
  }
}

export const vectorApi = new VectorAPI();
