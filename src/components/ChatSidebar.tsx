import { useState, useEffect, useCallback } from 'react';
import { Chat, getChats } from '@/lib/api';
import { CircleDot, MessageSquare, Send, Search } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useChat } from '@/contexts/ChatContext';
import { Input } from '@/components/ui/input';

interface ChatSidebarProps {
  onSelectChat: (chatId: number | null) => void;
  validChatIds?: number[];
}

const ChatSidebar = ({ onSelectChat, validChatIds }: ChatSidebarProps) => {
  const { chats, loading, unreadCount, selectedChat } = useChat();
  const [searchQuery, setSearchQuery] = useState('');

  // Log chats every render
  console.log('Sidebar render. Chats count:', chats.length);

  // Filter chats based on search query and validChatIds
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         chat.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const isValidId = validChatIds ? typeof chat.id === 'number' && !isNaN(chat.id) && chat.id !== null && chat.id !== undefined && validChatIds.includes(chat.id) : true;

    return matchesSearch && isValidId;
  });
  
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

  const waitingChats = filteredChats.filter(chat => chat.waiting);
  const regularChats = filteredChats.filter(chat => !chat.waiting);

  console.log('Sidebar filtered counts:', {
    all: chats.length,
    valid: filteredChats.length,
    waiting: waitingChats.length,
    regular: regularChats.length,
  });

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Chat List Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Сообщения</h2>
          <div className="relative w-40">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              type="text"
              placeholder="Поиск по чатам и тегам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
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
            
            {filteredChats.length === 0 && (
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
  const truncateMessage = (message: string | undefined, maxLength: number = 30) => {
    if (!message) return 'Нет сообщений';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };
  
  // Format timestamp
  const formatTime = (timestamp: string | undefined) => {
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
            <MessageSquare size={20} className="text-gray-500" />
          )}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {chat.name || `Чат #${chat.uuid}`}
          </h3>
          {chat.tags && chat.tags.length > 0 && (
            <div className="flex gap-1 ml-2 overflow-hidden">
              {chat.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex-shrink-0"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
            {chat.lastMessageTime && formatTime(chat.lastMessageTime)}
          </span>
        </div>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-500 truncate">
            {truncateMessage(chat.lastMessage)}
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
