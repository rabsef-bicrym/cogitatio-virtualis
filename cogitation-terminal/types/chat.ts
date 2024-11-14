// cogitation-terminal/types/chat.ts

export type MessageRole = 'user' | 'assistant' | 'system';
export type ComponentType = 'button' | 'link' | 'text';
export type StyleType = 'normal' | 'emphasis' | 'system';

export interface ChatComponent {
  type: ComponentType;
  props: {
    text: string;
    action?: string;
    href?: string;
    style?: StyleType;
  };
}

export interface ChatMessage {
  content: string;
  role: MessageRole;
  components?: ChatComponent[];
  metadata?: {
    messageId?: string;
    timestamp?: number;
  };
}

export interface ChatResponse {
  response: ChatMessage;
  metadata: {
    messageId: string;
    timestamp: number;
  };
}

export interface BootSequenceResponse {
  boot: ChatMessage[];
  haiku: ChatMessage;
}