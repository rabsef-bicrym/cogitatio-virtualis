// cogitatio-virtualis/virtualis-terminal/lib/mock/responses.ts

import { ChatMessage } from '@/types/chat';

export const MOCK_BOOT_SEQUENCE: ChatMessage[] = [
  {
    role: 'system',
    content: '[INIT] COGITATIO VIRTUALIS v1.0.0',
    components: [
      {
        type: 'text',
        props: {
          text: '[INIT] COGITATIO VIRTUALIS v1.0.0',
          style: 'system',
        },
      },
    ],
  },
  {
    role: 'system',
    content: '[SCAN] Loading knowledge matrices...',
    components: [
      {
        type: 'text',
        props: {
          text: '[SCAN] Loading knowledge matrices...',
          style: 'system',
        },
      },
    ],
  },
  {
    role: 'system',
    content: '[PROC] Converting legal complexity to programmatic clarity...',
    components: [
      {
        type: 'text',
        props: {
          text: '[PROC] Converting legal complexity to programmatic clarity...',
          style: 'system',
        },
      },
    ],
  },
  {
    role: 'system',
    content: '[SYNC] Engineering AI solutions for practical deployment...',
    components: [
      {
        type: 'text',
        props: {
          text: '[SYNC] Engineering AI solutions for practical deployment...',
          style: 'system',
        },
      },
    ],
  },
  {
    role: 'system',
    content: '[READY] Terminal interface prepared for interaction',
    components: [
      {
        type: 'text',
        props: {
          text: '[READY] Terminal interface prepared for interaction',
          style: 'system',
        },
      },
    ],
  },
];

export const MOCK_HAIKU_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Legal codes unfold\nLike autumn leaves in the wind\nKnowledge takes new form',
    components: [
      {
        type: 'text',
        props: {
          text: 'Legal codes unfold\nLike autumn leaves in the wind\nKnowledge takes new form',
          style: 'emphasis',
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: 'Silicon dreams flow\nThrough corridors of logic\nWisdom awakens',
    components: [
      {
        type: 'text',
        props: {
          text: 'Silicon dreams flow\nThrough corridors of logic\nWisdom awakens',
          style: 'emphasis',
        },
      },
    ],
  },
  {
    role: 'assistant',
    content:
      'Digital echoes\nCarry whispers of the law\nThrough quantum networks',
    components: [
      {
        type: 'text',
        props: {
          text: 'Digital echoes\nCarry whispers of the law\nThrough quantum networks',
          style: 'emphasis',
        },
      },
    ],
  },
];

export const MOCK_CHAT_RESPONSES: Record<string, ChatMessage[]> = {
  greeting: [
    {
      role: 'assistant',
      content:
        "Hello! I'm your guide through this technical journey. What would you like to explore?",
      components: [
        {
          type: 'text',
          props: {
            text: "Hello! I'm your guide through this technical journey.",
            style: 'normal',
          },
        },
        {
          type: 'button',
          props: {
            text: 'Technical Projects',
            action: 'SHOW_PROJECTS',
          },
        },
        {
          type: 'button',
          props: {
            text: 'AI Implementation',
            action: 'SHOW_AI',
          },
        },
      ],
    },
  ],
};

export function selectMockResponse(message: string): ChatMessage {
  // Simple response selection logic for development
  console.log(message); // LINT HACK
  const categories = Object.keys(MOCK_CHAT_RESPONSES);
  const randomCategory =
    categories[Math.floor(Math.random() * categories.length)];

  return MOCK_CHAT_RESPONSES[randomCategory][0];
}
