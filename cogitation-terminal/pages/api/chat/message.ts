// cogitatio-virtualis/cogitation-terminal/pages/api/chat/message.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { ChatResponse } from '@/types/chat';
import { selectMockResponse } from '@/lib/mock/responses';

interface ErrorResponse {
  error: string;
  code: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      code: 'METHOD_NOT_ALLOWED' 
    });
  }

  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid message format',
        code: 'INVALID_MESSAGE'
      });
    }

    if (process.env.NODE_ENV === 'development') {
      // Simulate network latency in development
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockResponse = selectMockResponse(message);
      
      return res.status(200).json({
        response: mockResponse,
        metadata: {
          messageId: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now()
        }
      });
    }

    // Production: Integration with Claude API
    // This will be implemented when we're ready to connect to Claude
    throw new Error('Production API not yet implemented');

  } catch (error) {
    console.error('Chat message error:', error);
    return res.status(500).json({
      error: 'Failed to process chat message',
      code: 'CHAT_PROCESSING_FAILED'
    });
  }
}