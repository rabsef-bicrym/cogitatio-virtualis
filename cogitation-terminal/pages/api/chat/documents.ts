// /api/chat/documents.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { vectorApi } from '@/lib/api/vector';
import { DocumentType, Document } from '@/types/documents';

interface DocumentsResponse {
  documents: Document[];
  total: number;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DocumentsResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.query;

  if (!type || !Object.values(DocumentType).includes(type as DocumentType)) {
    return res.status(400).json({ error: 'Invalid or missing document type' });
  }

  try {
    const results = await vectorApi.getDocumentsByType(type as DocumentType);
    const documents = results.map(doc => doc.metadata);

    return res.status(200).json({
      documents,
      total: documents.length
    });
  } catch (error) {
    console.error('Documents fetch error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documents' 
    });
  }
}
