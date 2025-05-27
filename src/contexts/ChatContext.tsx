import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Chat, Message, getChats, getChatMessages, sendMessage as apiSendMessage, markChatAsRead } from '@/lib/api';
import { useWebSocket } from './WebSocketContext';

interface ChatContextType {
  chats: Chat[];
  selectedChat: Chat | null;
  messages: Message[];
  loading: boolean;
  unreadCount: number;
  selectChat: (chatId: number) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  refreshChats: () => Promise<void>;
  markChatAsRead: (chatId: number) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { lastMessage, sendMessage: wsSendMessage } = useWebSocket();
  const isSelectingChat = useRef(false);

  const refreshChats = useCallback(async () => {
    try {
      setLoading(true);
      const chatData = await getChats();
      setChats(prevChats => {
        // Preserve selected chat state
        return chatData.map(newChat => {
          const prevChat = prevChats.find(c => c.id === newChat.id);
          return prevChat ? { ...newChat, ...prevChat } : newChat;
        });
      });
      
      // Calculate unread count
      const unread = chatData.filter(chat => chat.waiting).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'status_update' && lastMessage.chat) {
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => 
          chat.id === lastMessage.chat.id 
            ? { ...chat, waiting: lastMessage.chat.waiting }
            : chat
        );
        
        // Update unread count
        const unread = updatedChats.filter(chat => chat.waiting).length;
        setUnreadCount(unread);
        
        return updatedChats;
      });
    } 
    else if (lastMessage.chat && lastMessage.question) {
      setChats(prevChats => {
        const existingChat = prevChats.find(c => c.uuid === lastMessage.chat.uuid);
        
        if (!existingChat) {
          // New chat
          const newChat = {
            ...lastMessage.chat,
            lastMessage: lastMessage.question.message,
            lastMessageTime: lastMessage.question.created_at
          };
          
          // Update unread count
          setUnreadCount(prev => prev + 1);
          
          return [newChat, ...prevChats];
        }
        
        // Update existing chat
        const updatedChats = prevChats.map(chat => 
          chat.uuid === lastMessage.chat.uuid 
            ? {
                ...chat,
                ...lastMessage.chat,
                lastMessage: lastMessage.question.message,
                lastMessageTime: lastMessage.question.created_at
              }
            : chat
        );
        
        // Update unread count if chat is not selected
        if (selectedChat?.id !== existingChat.id) {
          setUnreadCount(prev => prev + 1);
        }
        
        return updatedChats;
      });

      // If this is the selected chat, update messages
      if (selectedChat?.uuid === lastMessage.chat.uuid) {
        setMessages(prev => {
          const newMessage: Message = {
            id: lastMessage.question.id,
            chat_id: lastMessage.chat.id,
            created_at: lastMessage.question.created_at,
            message: lastMessage.question.message,
            message_type: 'question' as const,
            ai: false
          };
          return [...prev, newMessage];
        });
      }
    }
  }, [lastMessage, selectedChat]);

  const selectChat = useCallback(async (chatId: number) => {
    if (isSelectingChat.current) return;
    
    try {
      isSelectingChat.current = true;
      
      // First, find the chat in our current list
      let chat = chats.find(c => c.id === chatId);
      
      // If chat not found, refresh the list
      if (!chat) {
        await refreshChats();
        chat = chats.find(c => c.id === chatId);
        if (!chat) {
          console.error('Chat not found after refresh:', chatId);
          return;
        }
      }

      // Set selected chat immediately to prevent UI lag
      setSelectedChat(chat);
      
      // Then fetch messages
      const messagesData = await getChatMessages(chatId);
      setMessages(messagesData);
      
      // Mark as read if it was unread
      if (chat.waiting) {
        await markChatAsRead(chatId);
        setChats(prevChats => 
          prevChats.map(c => 
            c.id === chatId 
              ? { ...c, waiting: false }
              : c
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to select chat:', error);
      // If there's an error, clear the selection
      setSelectedChat(null);
      setMessages([]);
    } finally {
      isSelectingChat.current = false;
    }
  }, [chats, refreshChats]);

  const sendMessage = useCallback(async (message: string) => {
    if (!selectedChat) return;

    try {
      const newMessage = await apiSendMessage(selectedChat.id, message, false);
      setMessages(prev => [...prev, newMessage]);
      wsSendMessage({ chat_id: selectedChat.uuid, message });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [selectedChat, wsSendMessage]);

  const markChatAsRead = useCallback(async (chatId: number) => {
    try {
      await markChatAsRead(chatId);
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId 
            ? { ...chat, waiting: false }
            : chat
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark chat as read:', error);
    }
  }, []);

  return (
    <ChatContext.Provider value={{
      chats,
      selectedChat,
      messages,
      loading,
      unreadCount,
      selectChat,
      sendMessage,
      refreshChats,
      markChatAsRead
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 