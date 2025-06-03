export interface Message {
  chatId: string;
  content: string;
  message_type: 'text';
  ai: boolean;
  timestamp: string;
}

export interface Chat {
  id: number;
  uuid: string;
  waiting: boolean;
  ai: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unread?: boolean;
}

export interface WebSocketMessage {
  type: 'message' | 'update';
  chatId: string;
  content: string;
  message_type: string;
  ai: boolean;
  timestamp: string;
} 