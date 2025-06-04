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

  // Handle WebSocket messages
  useEffect(() => {
    // Log 1: useEffect triggered with lastMessage
    console.log('ChatContext useEffect triggered. lastMessage:', lastMessage);

    if (!lastMessage) return;

    // Use a more specific type if possible, or be cautious with casting
    const wsMsg = lastMessage as unknown as WebSocketMessage;

    // Log 2: Checking message type
    console.log('Checking WebSocket message type. type:', wsMsg.type);

    // Обработка сообщений типа 'message' и 'update' (для новых сообщений и обновлений последнего сообщения в списке)
    if (wsMsg.type === 'message' || wsMsg.type === 'update') {
      // Log 3: Message type is message or update. Checking selected chat.
      console.log('Message type is message or update. Checking selected chat.');
      
      // **Используем значение из ref для сравнения**
      const currentSelectedChat = selectedChatRef.current;
      console.log('Comparing:', {
        selectedChatId: currentSelectedChat?.id, // Логируем ID выбранного чата из ref
        wsMsgChatId: wsMsg.chatId,
        comparisonResult: currentSelectedChat && currentSelectedChat.id === wsMsg.chatId
      });

      // Если это чат, который сейчас открыт — добавляем сообщение в messages
      // Убедимся, что wsMsg.chatId - число, так как selectedChat.id - число
      if (currentSelectedChat && currentSelectedChat.id === Number(wsMsg.chatId)) { // Сравниваем по id из БД
        // Log 4: Chat is selected and matches message chatId. Updating messages.
        console.log('Selected chat matches message chatId. Updating messages.', wsMsg);

        // Создаем объект сообщения, убедившись, что он соответствует типу Message
        const newMessage: Message = {
            id: wsMsg.id ?? Date.now(), // Используем id из wsMsg или временный
            chat_id: Number(wsMsg.chatId), // Убедимся, что это числовой ID чата
            created_at: wsMsg.timestamp || new Date().toISOString(), // Используем timestamp
            message: wsMsg.content || '', // Используем content
            message_type: (wsMsg.message_type === 'question' ? 'question' : (wsMsg.message_type === 'answer' ? 'answer' : 'text')), // Уточняем тип
            ai: wsMsg.ai ?? false, // Используем ai
          }

        console.log('Adding new message to state:', newMessage);

        setMessages(prev => [
          ...prev,
          newMessage
        ]);
        console.log('Messages updated. Current messages count (may be slightly behind): ', messages.length);
      } else {
        console.log('Selected chat does NOT match message chatId or selectedChat is null.');
      }

      // В любом случае обновляем последнее сообщение в списке чатов
      // Убедимся, что wsMsg.chatId - число для сравнения с chat.id
      setChats(prevChats => prevChats.map(chat =>
        chat.id === Number(wsMsg.chatId)
          ? {
              ...chat,
              lastMessage: wsMsg.content || '', // Используем content
              lastMessageTime: wsMsg.timestamp || chat.lastMessageTime, // Используем timestamp
              // Возможно, нужно также обновить waiting статус, если он есть в wsMsg и важен для списка
              // waiting: wsMsg.waiting ?? chat.waiting,
            }
          : chat
      ));
      console.log('Chats list updated.');
      // return; // Не завершаем обработку, если есть другие типы сообщений, которые нужно обработать в этом useEffect
    }

    // Здесь может быть логика для других типов сообщений, если они появятся В ЭТОМ ЖЕ useEffect
    // Если status_update и chat_deleted обрабатываются в другом useEffect, этот блок не нужен

  }, [lastMessage, messages.length]); // Добавил messages.length в зависимости, чтобы видеть актуальное количество сообщений в логе после setMessages

  // Получение статистики
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getChatStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Обработка удаления чата по WebSocket
  useEffect(() => {
    if (!lastUpdate) return;
    if (lastUpdate.type === 'chat_deleted' && lastUpdate.chatId) {
      setChats(prevChats => prevChats.filter(chat => String(chat.id) !== String(lastUpdate.chatId)));
      setSelectedChat(prev => (prev && String(prev.id) === String(lastUpdate.chatId) ? null : prev));
      fetchStats();
    }
    if (lastUpdate.type === 'chat_ai_updated' && lastUpdate.chatId) {
      setChats(prevChats => prevChats.map(chat => String(chat.id) === String(lastUpdate.chatId) ? { ...chat, ai: lastUpdate.ai } : chat));
      fetchStats();
    }
  }, [lastUpdate, fetchStats]);

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