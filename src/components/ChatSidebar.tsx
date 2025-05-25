import { useState, useEffect } from 'react';
import { Chat, getChats } from '@/lib/api';
import { CircleDot, MessageSquare } from 'lucide-react';

interface ChatSidebarProps {
  onSelectChat: (chatId: number) => void;
  selectedChatId: number | null;
  validChatIds?: number[];
}

const ChatSidebar = ({ onSelectChat, selectedChatId, validChatIds }: ChatSidebarProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  // Log chats every render
  console.log('Rendering sidebar with chats:', chats);

  const fetchChats = async () => {
    try {
      const chatData = await getChats();
      console.log('Fetched chats from backend:', chatData);
      setChats(chatData);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
    // WebSocket client
    let ws = new WebSocket('ws://localhost:3002');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'frontend' }));
    };
    ws.onmessage = async (event) => {
      try {
        // Convert Blob to text if needed
        const data = event.data instanceof Blob 
          ? JSON.parse(await event.data.text())
          : JSON.parse(event.data);
        if (
          data.type === 'status_update' ||
          data.type === 'chat_deleted' ||
          data.type === 'stats_update'
        ) {
          // Refetch the chat list from the backend
          fetchChats();
        } else if (data.chat && data.question) {
          // Refetch chats when a new message is received
          fetchChats();
          setChats((prevChats) => {
            const idx = prevChats.findIndex(c => c.id === data.chat.id || c.uuid === data.chat.uuid);
            let lastMessage = data.answer ? data.answer.message : data.question.message;
            let lastMessageTime = data.answer ? data.answer.created_at : data.question.created_at;
            let updatedChat = {
              ...data.chat,
              lastMessage,
              lastMessageTime
            };
            if (idx !== -1) {
              // Обновляем существующий чат
              const newChats = [...prevChats];
              newChats[idx] = { ...newChats[idx], ...updatedChat };
              return newChats;
            } else {
              // Добавляем новый чат
              return [updatedChat, ...prevChats];
            }
          });
        }
      } catch (e) {
        console.error('WS message parse error', e);
      }
    };
    ws.onerror = (e) => {
      console.error('WebSocket error', e);
    };
    return () => {
      ws && ws.close();
    };
  }, []);

  // Only render chats with valid id and in validChatIds
  let validChats = chats.filter(chat => typeof chat.id === 'number' && !isNaN(chat.id) && chat.id !== null && chat.id !== undefined);
  if (validChatIds) {
    validChats = validChats.filter(chat => validChatIds.includes(chat.id));
  }
  const waitingChats = validChats.filter(chat => chat.waiting);
  const regularChats = validChats.filter(chat => !chat.waiting);

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
                
                {waitingChats.map(chat => (
                  <ChatPreview 
                    key={chat.id} 
                    chat={chat} 
                    isSelected={selectedChatId === chat.id} 
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
              
              {regularChats.map(chat => (
                <ChatPreview 
                  key={chat.id} 
                  chat={chat} 
                  isSelected={selectedChatId === chat.id} 
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
          {chat.uuid.charAt(0).toUpperCase()}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            Чат #{chat.uuid}
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
