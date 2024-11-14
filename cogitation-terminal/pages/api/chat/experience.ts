// cogitatio-virtualis/cogitation-terminal/pages/api/chat/experience.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { vectorApi } from '@/lib/api/vector';
import { DocumentType, ExperienceDocument } from '@/types/documents';

interface ExperienceResponse {
  documents: ExperienceDocument[];
  total: number;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExperienceResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const results = await vectorApi.getDocumentsByType(DocumentType.EXPERIENCE);
    const documents = results
      .map(doc => doc.metadata)
      .filter((doc): doc is ExperienceDocument => doc.type === DocumentType.EXPERIENCE)
      .sort((a, b) => {
        // Sort by date, with "Present" at the top
        const dateA = a.date_end === 'Present' ? '9999' : a.date_end;
        const dateB = b.date_end === 'Present' ? '9999' : b.date_end;
        return dateB.localeCompare(dateA);
      });

    return res.status(200).json({
      documents,
      total: documents.length
    });
  } catch (error) {
    console.error('Experience fetch error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch experience documents' 
    });
  }
}