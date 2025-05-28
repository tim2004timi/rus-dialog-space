import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Chat, Message, getChats, getChatMessages, sendMessage as apiSendMessage, markChatAsRead as apiMarkChatAsRead } from '@/lib/api';
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
    if (!lastMessage) return;

    console.log('WebSocket message received:', lastMessage);

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
    // Handle new client messages or updates to existing chats (including manager replies)
    else if (lastMessage.chat) {
      setChats(prevChats => {
        const existingChatIndex = prevChats.findIndex(c => c.uuid === lastMessage.chat.uuid);
        const incomingChat = lastMessage.chat;

        if (existingChatIndex === -1) {
          // New chat received
          const newChat = {
            ...incomingChat,
            lastMessage: lastMessage.question?.message || '',
            lastMessageTime: lastMessage.question?.created_at || new Date().toISOString(),
            waiting: lastMessage.question ? true : incomingChat.waiting
          };

          // Update unread count if it's a new client message
          if (lastMessage.question) {
            setUnreadCount(prev => prev + 1);
          }

          // Add the new chat to the beginning of the list
          return [newChat, ...prevChats];

        } else {
          // Update existing chat
          const updatedChats = [...prevChats];
          const existingChat = updatedChats[existingChatIndex];

          // Update chat details, including the waiting status from the incoming message
          updatedChats[existingChatIndex] = {
            ...existingChat,
            ...incomingChat,
            lastMessage: lastMessage.question?.message || lastMessage.answer?.message || existingChat.lastMessage,
            lastMessageTime: lastMessage.question?.created_at || lastMessage.answer?.created_at || existingChat.lastMessageTime,
            waiting: incomingChat.waiting
          };

          // Recalculate unread count based on the updated list
          const unread = updatedChats.filter(chat => chat.waiting).length;
          setUnreadCount(unread);

          // Optionally, move the updated chat to the top of the list
          const [movedChat] = updatedChats.splice(existingChatIndex, 1);
          console.log('Chats after WebSocket update:', [movedChat, ...updatedChats]);
          return [movedChat, ...updatedChats];
        }
      });

      // If this is the selected chat, update messages
      if (selectedChat?.uuid === lastMessage.chat.uuid) {
         // Add new message if it exists in the payload
        setMessages(prev => {
          let updatedMessages = [...prev];
          const newMessageData = lastMessage.question || lastMessage.answer;
          if (newMessageData) {
             const exists = updatedMessages.some(m => m.id === newMessageData.id);
             if (!exists) {
               const messageType = lastMessage.question ? 'question' : 'answer';
               const newMsg: Message = {
                 id: newMessageData.id,
                 chat_id: lastMessage.chat.id,
                 created_at: newMessageData.created_at,
                 message: newMessageData.message,
                 message_type: messageType as 'question' | 'answer',
                 ai: !!newMessageData.ai
               };
               updatedMessages.push(newMsg);
             }
          }
           // Sort by time and type to ensure correct order
           return updatedMessages.sort((a, b) => {
             const timeA = new Date(a.created_at).getTime();
             const timeB = new Date(b.created_at).getTime();
             if (timeA === timeB) {
               return a.message_type === 'question' ? -1 : 1; // Question before answer if same time
             }
             return timeA - timeB;
           });
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
      wsSendMessage({ chat_id: selectedChat.uuid, message });
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