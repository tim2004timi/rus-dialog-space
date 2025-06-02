export interface Message {
  content: string;
  isBot: boolean;
  timestamp?: string;
  chatId?: string;
}

export interface WebSocketMessage {
  type: 'message' | 'update';
  chatId: string;
  content?: string;
  timestamp?: string;
  [key: string]: any;
} 