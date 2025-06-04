import React, { useState, useEffect, useCallback } from 'react';
import { Chat, getChats } from '@/lib/api';
import { useWebSocket } from '../contexts/WebSocketContext';

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  selectedChatId?: string;
}

export const ChatList: React.FC<ChatListProps> = ({ onSelectChat, selectedChatId }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { lastUpdate } = useWebSocket();

  const loadChats = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getChats();
      console.log('Loaded chats:', data);
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Refresh chats when receiving an update
  useEffect(() => {
    if (lastUpdate) {
      console.log('Received chat update:', lastUpdate);
      loadChats();
    }
  }, [lastUpdate, loadChats]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
            selectedChatId === chat.uuid ? 'bg-blue-50' : ''
          }`}
          onClick={() => onSelectChat(chat.uuid)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium">
                {chat.name || `Чат #${chat.id}`}
                {chat.ai && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    AI
                  </span>
                )}
              </div>
              {chat.lastMessage && (
                <div className="text-sm text-gray-600 mt-1 truncate">
                  {chat.lastMessage}
                </div>
              )}
            </div>
            {chat.waiting && (
              <div className="ml-2">
                <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}; 