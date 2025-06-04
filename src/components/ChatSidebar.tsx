import { useState, useEffect, useCallback } from 'react';
import { Chat, getChats } from '@/lib/api';
import { CircleDot, MessageSquare, Send } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useChat } from '@/contexts/ChatContext';

interface ChatSidebarProps {
  onSelectChat: (chatId: number | null) => void;
  validChatIds?: number[];
}

const ChatSidebar = ({ onSelectChat, validChatIds }: ChatSidebarProps) => {
  const { chats, loading, unreadCount, selectedChat } = useChat();

  // Log chats every render
  console.log('Sidebar render. Chats count:', chats.length);

  // Only render chats with valid id and in validChatIds
  let validChats = chats.filter(chat => typeof chat.id === 'number' && !isNaN(chat.id) && chat.id !== null && chat.id !== undefined);
  
  // Update validChatIds when new chats are added
  useEffect(() => {
    if (validChatIds) {
      const newChatIds = chats
        .filter(chat => typeof chat.id === 'number' && !isNaN(chat.id))
        .map(chat => chat.id);
      
      // If we have new chat IDs that aren't in validChatIds, update the parent
      const hasNewChats = newChatIds.some(id => validChatIds && !validChatIds.includes(id));
      if (hasNewChats) {
        console.log('Sidebar: New chat IDs detected, updating parent.');
        onSelectChat(selectedChat?.id || null); // Pass null if selectedChat is null
      }
    }
  }, [chats, validChatIds, selectedChat, onSelectChat]);

  const waitingChats = validChats.filter(chat => chat.waiting);
  const regularChats = validChats.filter(chat => !chat.waiting);

  console.log('Sidebar filtered counts:', {
    all: chats.length,
    valid: validChats.length,
    waiting: waitingChats.length,
    regular: regularChats.length,
  });

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Chat List Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Сообщения</h2>
      </div>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Загрузка чатов...</div>
        ) : (
          <>
            {/* Waiting Response Section */}
            {waitingChats.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Ожидают ответа
                </div>
                
                {waitingChats.map((chat) => (
                  <ChatPreview 
                    key={chat.id}
                    chat={chat} 
                    isSelected={selectedChat?.id === chat.id} 
                    onClick={() => {
                      console.log('Sidebar selecting chat:', chat);
                      onSelectChat(chat.id);
                    }} 
                  />
                ))}
              </div>
            )}
            
            {/* Regular Chats Section */}
            <div>
              {waitingChats.length > 0 && (
                <div className="px-4 py-2 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Все сообщения
                </div>
              )}
              
              {regularChats.map((chat) => (
                <ChatPreview 
                  key={chat.id}
                  chat={chat} 
                  isSelected={selectedChat?.id === chat.id} 
                  onClick={() => {
                    console.log('Sidebar selecting chat:', chat);
                    onSelectChat(chat.id);
                  }} 
                />
              ))}
            </div>
            
            {chats.length === 0 && (
              <div className="p-4 text-center text-gray-500">Нет доступных чатов</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface ChatPreviewProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

const ChatPreview = ({ chat, isSelected, onClick }: ChatPreviewProps) => {
  console.log('Rendering ChatPreview for chat:', chat);
  const truncateMessage = (message: string, maxLength: number = 30) => {
    if (!message) return 'Нет сообщений';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div 
      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors flex items-start ${isSelected ? 'bg-gray-100' : ''}`}
      onClick={onClick}
    >
      <div className="mr-3 flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
          {chat.messager === 'telegram' ? (
            <Send size={20} className="text-blue-500" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-300" />
          )}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {chat.name || `Чат #${chat.uuid}`}
          </h3>
          <span className="text-xs text-gray-500">
            {chat.lastMessageTime && formatTime(chat.lastMessageTime)}
          </span>
        </div>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-500 truncate">
            {truncateMessage(chat.lastMessage || '')}
          </p>
          
          <div className="flex items-center ml-2">
            {chat.waiting && (
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1" />
            )}
            
            {chat.ai && (
              <div className="text-xs px-1.5 py-0.5 bg-gray-300 text-aiHighlight rounded-sm">
                ИИ
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
