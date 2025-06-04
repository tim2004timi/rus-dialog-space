import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Chat, Message, getChats, getChatMessages, sendMessage as apiSendMessage, markChatAsRead as apiMarkChatAsRead, getChatStats } from '@/lib/api';
import { useWebSocket } from './WebSocketContext';
import type { WebSocketMessage } from '@/types';

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
  const { lastMessage, sendMessage: wsSendMessage, lastUpdate } = useWebSocket();
  const isSelectingChat = useRef(false);
  const selectedChatRef = useRef<Chat | null>(null);
  const [stats, setStats] = useState<{ total: number; pending: number; ai: number }>({ total: 0, pending: 0, ai: 0 });
  const lastStatsUpdate = useRef<number>(0);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

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
      console.log('Chats after refreshChats:', chatData);
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

  // Получение статистики
  const fetchStats = useCallback(async () => {
    const now = Date.now();
    // Обновляем статистику не чаще чем раз в 2 секунды
    if (now - lastStatsUpdate.current < 2000) {
      return;
    }
    try {
      const statsData = await getChatStats();
      setStats(statsData);
      lastStatsUpdate.current = now;
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = typeof lastMessage === 'string' ? JSON.parse(lastMessage) : lastMessage;
      console.log('WebSocket message received:', data);

      if (data.type === 'message') {
        const wsMsg = data;
        console.log('Processing WebSocket message:', wsMsg);
        
        // Log 1: useEffect triggered with lastMessage
        console.log('ChatContext useEffect triggered. lastMessage:', lastMessage);

        // Use a more specific type if possible, or be cautious with casting
        const wsMsgTyped = wsMsg as unknown as WebSocketMessage;

        // Log 2: Checking message type
        console.log('Checking WebSocket message type. type:', wsMsgTyped.type);

        // Обработка сообщений типа 'message' и 'update' (для новых сообщений и обновлений последнего сообщения в списке)
        if (wsMsgTyped.type === 'message' || wsMsgTyped.type === 'update') {
          // Log 3: Message type is message or update. Checking selected chat.
          console.log('Message type is message or update. Checking selected chat.');

          // Получаем текущее значение selectedChat из ref
          const currentSelectedChat = selectedChatRef.current;
          console.log('Current selected chat from ref:', currentSelectedChat);

          console.log('Comparing:', {
            selectedChatId: currentSelectedChat?.id,
            wsMsgChatId: wsMsgTyped.chatId,
            comparisonResult: currentSelectedChat && currentSelectedChat.id === wsMsgTyped.chatId
          });

          // Если это чат, который сейчас открыт — добавляем сообщение в messages
          if (currentSelectedChat && currentSelectedChat.id === Number(wsMsgTyped.chatId)) {
            console.log('Selected chat matches message chatId. Updating messages.', wsMsgTyped);

            const newMessage: Message = {
              id: wsMsgTyped.id ?? Date.now(),
              chat_id: Number(wsMsgTyped.chatId),
              created_at: wsMsgTyped.timestamp || new Date().toISOString(),
              message: wsMsgTyped.content || '',
              message_type: wsMsgTyped.message_type === 'question' ? 'question' : 'answer',
              ai: wsMsgTyped.ai ?? false,
            }

            setMessages(prevMessages => [...prevMessages, newMessage]);
            console.log('Messages updated with new message.');
          }

          // Обновляем список чатов
          setChats(prevChats => {
            const updatedChats = prevChats.map(chat =>
              chat.id === Number(wsMsgTyped.chatId)
                ? {
                    ...chat,
                    lastMessage: wsMsgTyped.content || '',
                    lastMessageTime: wsMsgTyped.timestamp || chat.lastMessageTime,
                  }
                : chat
            );
            return updatedChats;
          });
          console.log('Chats list updated.');
        }
      } else if (data.type === 'chat_update') {
        console.log('Processing chat update:', data);
        
        // Update chat status in the messages list
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.chat_id === data.chat_id) {
              return { ...msg, waiting: data.waiting };
            }
            return msg;
          });
        });

        // Update selected chat if it's the one being updated
        if (selectedChatRef.current?.id === data.chat_id) {
          setSelectedChat(prev => {
            if (prev) {
              return { ...prev, waiting: data.waiting };
            }
            return prev;
          });
        }

        // Update chats list
        setChats(prevChats => {
          const updatedChats = prevChats.map(chat =>
            chat.id === data.chat_id
              ? { ...chat, waiting: data.waiting }
              : chat
          );
          return updatedChats;
        });

        // Обновляем статистику при изменении статуса чата
        fetchStats();
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, [lastMessage, fetchStats]);

  // Обработка удаления чата по WebSocket
  useEffect(() => {
    if (!lastUpdate) return;
    
    if (lastUpdate.type === 'chat_deleted' && lastUpdate.chatId) {
      setChats(prevChats => prevChats.filter(chat => String(chat.id) !== String(lastUpdate.chatId)));
      setSelectedChat(prev => (prev && String(prev.id) === String(lastUpdate.chatId) ? null : prev));
      fetchStats();
    }
    if (lastUpdate.type === 'chat_ai_updated' && lastUpdate.chatId) {
      setChats(prevChats => prevChats.map(chat => 
        String(chat.id) === String(lastUpdate.chatId) 
          ? { ...chat, ai: lastUpdate.ai } 
          : chat
      ));
      fetchStats();
    }
  }, [lastUpdate, fetchStats]);

  // Начальная загрузка статистики
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

      // Then fetch messages
      const messagesData = await getChatMessages(chatId);
      setMessages(messagesData);
      
      // Set selected chat AFTER messages are loaded
      setSelectedChat(chat);
      
      // Mark as read if it was unread
      if (chat.waiting) {
        await apiMarkChatAsRead(chatId);
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
      // При отправке используем selectedChat.id (ID из БД) для chat_id
      wsSendMessage({
        id: newMessage.id, // Используем id созданного сообщения
        chat_id: selectedChat.id, // ID чата из БД
        created_at: newMessage.created_at, // Используем timestamp созданного сообщения
        message: message, // Содержимое сообщения
        message_type: 'text', // Тип сообщения
        ai: false // Это сообщение пользователя, не AI
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [selectedChat, wsSendMessage]);

  const markChatAsRead = useCallback(async (chatId: number) => {
    try {
      await apiMarkChatAsRead(chatId);
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