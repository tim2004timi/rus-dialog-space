import { toast } from '@/components/ui/sonner';
import { config } from '@/config';

export const API_URL = config.apiUrl;

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

// Get all chats
export const getChats = async (): Promise<Chat[]> => {
  try {
    const response = await fetch(`${API_URL}/chats`);
    if (!response.ok) {
      throw new Error('Failed to fetch chats');
    }
    const chats = await response.json();
    return chats.map((chat: any) => ({
      id: chat.id,
      uuid: chat.uuid,
      waiting: chat.waiting,
      ai: chat.ai,
      lastMessage: chat.last_message?.content || '',
      lastMessageTime: chat.last_message?.timestamp || '',
      unread: false // This should be implemented based on your business logic
    }));
  } catch (error) {
    console.error('Error fetching chats:', error);
    toast.error('Не удалось загрузить список чатов');
    return [];
  }
};

// Get messages for a specific chat
export const getChatMessages = async (chatId: number | string, page: number = 1, limit: number = 50): Promise<Message[]> => {
  try {
    const response = await fetch(`${API_URL}/chats/${chatId}/messages?page=${page}&limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    const messages = await response.json();
    return messages.map((msg: any) => ({
      chatId: msg.chatId || msg.chat_id?.toString() || chatId.toString(),
      content: msg.content || msg.message,
      message_type: msg.message_type || 'text',
      ai: typeof msg.ai === 'boolean' ? msg.ai : false,
      timestamp: msg.timestamp || msg.created_at || ''
    }));
  } catch (error) {
    console.error('Error fetching messages:', error);
    toast.error('Не удалось загрузить сообщения');
    return [];
  }
};

// Send a new message
export const sendMessage = async (chatId: number, message: string, isAi: boolean): Promise<Message> => {
  try {
    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message,
        message_type: 'answer',
        ai: isAi
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    const newMessage = await response.json();
    
    // Update chat waiting status
    await fetch(`${API_URL}/chats/${chatId}/waiting`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ waiting: false }),
    });
    
    return {
      id: newMessage.id,
      chat_id: newMessage.chat_id,
      created_at: newMessage.created_at,
      message: newMessage.message,
      message_type: newMessage.message_type,
      ai: newMessage.ai
    };
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Не удалось отправить сообщение');
    throw error;
  }
};

// Toggle AI status for a chat
export const toggleAiChat = async (chatId: number, aiEnabled: boolean): Promise<Chat> => {
  try {
    console.log('Toggling AI status:', { chatId, aiEnabled });
    
    const response = await fetch(`${API_URL}/chats/${chatId}/ai`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ai: aiEnabled }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to update chat AI status:', errorData);
      throw new Error('Failed to update chat');
    }
    
    const chat = await response.json();
    console.log('Chat AI status updated successfully:', chat);
    
    return {
      id: chat.id,
      uuid: chat.uuid,
      waiting: chat.waiting,
      ai: chat.ai
    };
  } catch (error) {
    console.error('Error toggling AI status:', error);
    toast.error('Не удалось обновить статус ИИ');
    throw error;
  }
};

// Mark chat as read
export const markChatAsRead = async (chatId: number): Promise<void> => {
  try {
    console.log('Marking chat as read:', chatId);
    
    const response = await fetch(`${API_URL}/chats/${chatId}/waiting`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ waiting: false }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to update chat waiting status:', errorData);
      throw new Error('Failed to update chat waiting status');
    }
    
    const result = await response.json();
    console.log('Chat marked as read successfully:', result);
  } catch (error) {
    console.error('Error marking chat as read:', error);
  }
};

// Get chat statistics
export const getChatStats = async (): Promise<{ total: number, pending: number, ai: number }> => {
  try {
    const response = await fetch(`${API_URL}/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching chat statistics:', error);
    return { total: 0, pending: 0, ai: 0 };
  }
};

// Delete a chat
export const deleteChat = async (chatId: number | string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/chats/${chatId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to delete chat:', errorData);
      throw new Error('Failed to delete chat');
    }
  } catch (error) {
    console.error('Error deleting chat:', error);
    toast.error('Не удалось удалить чат');
    throw error;
  }
};
