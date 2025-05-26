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
        
        console.log('Received WebSocket message:', data);
        
        if (data.type === 'status_update') {
          // Update chat status in the local state
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.id === data.chatId 
                ? { ...chat, waiting: data.waiting }
                : chat
            )
          );
        } else if (data.type === 'chat_deleted') {
          // Remove deleted chat from the list
          setChats(prevChats => prevChats.filter(chat => chat.id !== data.chatId));
        } else if (data.type === 'stats_update') {
          // Stats update doesn't require chat list update
          return;
        } else if (data.chat) {
          // Handle new chat or chat update
          setChats(prevChats => {
            const existingChat = prevChats.find(c => c.uuid === data.chat.uuid);
            console.log('Existing chat found:', existingChat);
            
            // If chat doesn't exist in our list, fetch it from API
            if (!existingChat) {
              console.log('Chat not found in list, fetching from API:', data.chat.uuid);
              // Fetch the chat from API
              fetch(`http://localhost:3001/api/chats/${data.chat.uuid}`)
                .then(response => {
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                  return response.json();
                })
                .then(newChat => {
                  console.log('Received new chat from API:', newChat);
                  // Add message information to the new chat
                  const chatWithMessage = {
                    ...newChat,
                    lastMessage: data.question.message,
                    lastMessageTime: data.question.created_at
                  };
                  console.log('Prepared chat with message:', chatWithMessage);
                  
                  setChats(currentChats => {
                    console.log('Current chats before update:', currentChats);
                    const alreadyExists = currentChats.some(c => c.uuid === chatWithMessage.uuid);
                    if (!alreadyExists) {
                      const updatedChats = [chatWithMessage, ...currentChats];
                      console.log('Updated chats list:', updatedChats);
                      return updatedChats;
                    }
                    console.log('Chat already exists in list');
                    return currentChats;
                  });
                })
                .catch(error => {
                  console.error('Error fetching new chat:', error);
                  // If API call fails, try to use the chat data from WebSocket
                  console.log('Using WebSocket data as fallback:', data.chat);
                  setChats(currentChats => {
                    const alreadyExists = currentChats.some(c => c.uuid === data.chat.uuid);
                    if (!alreadyExists) {
                      const chatWithMessage = {
                        ...data.chat,
                        lastMessage: data.question.message,
                        lastMessageTime: data.question.created_at
                      };
                      console.log('Adding fallback chat to list:', chatWithMessage);
                      const updatedChats = [chatWithMessage, ...currentChats];
                      console.log('Updated chats list (fallback):', updatedChats);
                      return updatedChats;
                    }
                    console.log('Fallback chat already exists in list');
                    return currentChats;
                  });
                });
              return prevChats; // Return current chats while fetching
            }

            // If chat exists, update it
            const idx = prevChats.findIndex(c => c.uuid === data.chat.uuid);
            let lastMessage = data.answer ? data.answer.message : data.question.message;
            let lastMessageTime = data.answer ? data.answer.created_at : data.question.created_at;
            let updatedChat = {
              ...data.chat,
              lastMessage,
              lastMessageTime
            };
            
            if (idx !== -1) {
              console.log('Updating existing chat:', updatedChat);
              // Update existing chat
              const newChats = [...prevChats];
              newChats[idx] = { ...newChats[idx], ...updatedChat };
              console.log('Updated chats list:', newChats);
              return newChats;
            }
            
            return prevChats;
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
  
  // Update validChatIds when new chats are added
  useEffect(() => {
    if (validChatIds) {
      const newChatIds = chats
        .filter(chat => typeof chat.id === 'number' && !isNaN(chat.id))
        .map(chat => chat.id);
      
      // If we have new chat IDs that aren't in validChatIds, update the parent
      const hasNewChats = newChatIds.some(id => !validChatIds.includes(id));
      if (hasNewChats) {
        console.log('New chat IDs detected, updating parent:', newChatIds);
        onSelectChat(selectedChatId); // This will trigger a re-render with updated validChatIds
      }
    }
  }, [chats, validChatIds, selectedChatId, onSelectChat]);

  const waitingChats = validChats.filter(chat => chat.waiting);
  const regularChats = validChats.filter(chat => !chat.waiting);

  console.log('Filtered chats:', {
    all: chats,
    valid: validChats,
    waiting: waitingChats,
    regular: regularChats,
    validChatIds
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
                
                {waitingChats.map(chat => (
                  <ChatPreview 
                    key={chat.uuid} 
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
                  key={chat.uuid} 
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
