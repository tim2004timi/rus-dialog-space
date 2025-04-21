
import { toast } from '@/components/ui/sonner';
import { setupMockData } from './db';

// Types
export interface Chat {
  id: number;
  uuid: string;
  waiting: boolean;
  ai: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unread?: boolean;
}

export interface Message {
  id: number;
  chat_id: number;
  created_at: string;
  message: string;
  message_type: 'question' | 'answer';
  ai: boolean;
}

// In a real application, you would connect to your API endpoints
// For now, we'll use mock data and simulate API calls

let mockData: { chats: any[], messages: any[] } | null = null;

const initMockData = async () => {
  if (!mockData) {
    mockData = await setupMockData() || { chats: [], messages: [] };
  }
  return mockData;
};

// Helper to simulate API request delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get all chats
export const getChats = async (): Promise<Chat[]> => {
  try {
    await initMockData();
    await delay(300); // Simulate network delay
    
    if (!mockData) {
      throw new Error('Failed to load chat data');
    }
    
    const chatsList = [...mockData.chats];
    
    // Add last message to each chat
    return chatsList.map((chat: any, index: number) => {
      const chatMessages = mockData?.messages.filter(m => m.chat_id === index + 1) || [];
      const lastMsg = chatMessages.length > 0 ? 
        chatMessages[chatMessages.length - 1] : 
        null;
      
      return {
        id: index + 1,
        uuid: chat.uuid,
        waiting: chat.waiting,
        ai: chat.ai,
        lastMessage: lastMsg ? lastMsg.message : '',
        lastMessageTime: lastMsg ? new Date().toISOString() : new Date().toISOString(),
        unread: Math.random() > 0.5 // Randomly set some chats as unread for demo
      };
    }).sort((a, b) => {
      // Sort by waiting first, then by lastMessageTime
      if (a.waiting && !b.waiting) return -1;
      if (!a.waiting && b.waiting) return 1;
      return new Date(b.lastMessageTime!).getTime() - new Date(a.lastMessageTime!).getTime();
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    toast.error('Не удалось загрузить список чатов');
    return [];
  }
};

// Get messages for a specific chat
export const getChatMessages = async (chatId: number): Promise<Message[]> => {
  try {
    await initMockData();
    await delay(200);
    
    if (!mockData) {
      throw new Error('Failed to load message data');
    }
    
    const messages = mockData.messages
      .filter(msg => msg.chat_id === chatId)
      .map((msg, index) => ({
        id: index + 1,
        chat_id: msg.chat_id,
        created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random time in the last 24h
        message: msg.message,
        message_type: msg.message_type,
        ai: msg.ai
      }));
    
    return messages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    toast.error('Не удалось загрузить сообщения');
    return [];
  }
};

// Send a new message
export const sendMessage = async (chatId: number, message: string, isAi: boolean): Promise<Message> => {
  try {
    await initMockData();
    await delay(300);
    
    if (!mockData) {
      throw new Error('Failed to send message');
    }
    
    const newMessage = {
      id: mockData.messages.length + 1,
      chat_id: chatId,
      created_at: new Date().toISOString(),
      message,
      message_type: 'answer' as const,
      ai: isAi
    };
    
    // Add to our mock data
    mockData.messages.push(newMessage);
    
    // Update chat waiting status
    const chatIndex = mockData.chats.findIndex((c, idx) => idx + 1 === chatId);
    if (chatIndex >= 0) {
      mockData.chats[chatIndex].waiting = false;
    }
    
    return newMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Не удалось отправить сообщение');
    throw error;
  }
};

// Toggle AI status for a chat
export const toggleAiChat = async (chatId: number, aiEnabled: boolean): Promise<Chat> => {
  try {
    await initMockData();
    await delay(200);
    
    if (!mockData) {
      throw new Error('Failed to update chat');
    }
    
    const chatIndex = mockData.chats.findIndex((c, idx) => idx + 1 === chatId);
    if (chatIndex >= 0) {
      mockData.chats[chatIndex].ai = aiEnabled;
      
      return {
        id: chatId,
        uuid: mockData.chats[chatIndex].uuid,
        waiting: mockData.chats[chatIndex].waiting,
        ai: aiEnabled
      };
    }
    throw new Error('Chat not found');
  } catch (error) {
    console.error('Error toggling AI status:', error);
    toast.error('Не удалось обновить статус ИИ');
    throw error;
  }
};

// Mark chat as read
export const markChatAsRead = async (chatId: number): Promise<void> => {
  // In a real application, you would make an API call to update the database
  await delay(100);
  // Since we're using mock data, we don't need to do anything here
  // The UI will handle the visual updates
};

// Get chat statistics
export const getChatStats = async (): Promise<{ total: number, pending: number, ai: number }> => {
  try {
    await initMockData();
    await delay(150);
    
    if (!mockData) {
      throw new Error('Failed to load statistics');
    }
    
    const total = mockData.chats.length;
    const pending = mockData.chats.filter(c => c.waiting).length;
    const ai = mockData.chats.filter(c => c.ai).length;
    
    return { total, pending, ai };
  } catch (error) {
    console.error('Error fetching chat statistics:', error);
    return { total: 0, pending: 0, ai: 0 };
  }
};
