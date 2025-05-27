import { useState, useEffect, useRef } from 'react';
import ChatSidebar from '@/components/ChatSidebar';
import ChatView from '@/components/ChatView';
import ChatStats from '@/components/ChatStats';
import { getChats } from '@/lib/api';
import { useWebSocket } from '@/contexts/WebSocketContext';

const Index = () => {
  const [selectedChatId, setSelectedChatIdRaw] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<number[]>([]);
  const selectedChatIdRef = useRef<number | null>(null);
  const { lastMessage } = useWebSocket();

  // Wrapper to log every selection and update ref
  const setSelectedChatId = (id: number | null) => {
    console.log('handleSelectChat called with:', id);
    if (id !== null && !chatIds.includes(id)) {
      console.warn('Attempted to set invalid selectedChatId:', id, 'Valid chatIds:', chatIds, new Error().stack);
      return;
    }
    console.log('Setting selectedChatId:', id);
    setSelectedChatIdRaw(id);
    selectedChatIdRef.current = id;
  };

  // Fetch chat list and update chatIds
  const fetchAndSyncChats = async () => {
    const chats = await getChats();
    const ids = chats.map(chat => chat.id);
    console.log('Updating chatIds:', ids);
    setChatIds(ids);
    
    // If selectedChatId is not in the new list, just clear it
    if (selectedChatIdRef.current !== null && !ids.includes(selectedChatIdRef.current)) {
      console.log('Selected chat not in new list, clearing selection');
      setSelectedChatId(null);
    }
  };

  useEffect(() => {
    fetchAndSyncChats();
  }, []);

  const handleSelectChat = async (chatId: number) => {
    console.log('handleSelectChat called with:', chatId, 'Current chatIds:', chatIds);
    
    // Always fetch latest chats before selection
    await fetchAndSyncChats();
    
    // Now check if the chat is valid with the latest data
    if (chatId !== null && !chatIds.includes(chatId)) {
      console.warn('Chat not found after refresh:', chatId, 'Valid chatIds:', chatIds);
      return;
    }
    
    console.log('Setting selectedChatId:', chatId);
    setSelectedChatIdRaw(chatId);
    selectedChatIdRef.current = chatId;
  };

  const handleChatDeleted = () => {
    setSelectedChatId(null);
    fetchAndSyncChats();
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (30% width) */}
        <div className="w-full md:w-1/3 lg:w-3/10 flex flex-col border-r border-gray-300">
          <ChatStats />
          <div className="flex-1 overflow-hidden">
            <ChatSidebar
              onSelectChat={handleSelectChat}
              selectedChatId={selectedChatId}
              validChatIds={chatIds}
            />
          </div>
        </div>
        
        {/* Main Content (70% width) */}
        <div className="hidden md:block md:w-2/3 lg:w-7/10 flex-1 border-l border-gray-200">
          <ChatView 
            chatId={selectedChatId} 
            onChatDeleted={handleChatDeleted}
          />
        </div>
        
        {/* Mobile view - Show chat when selected */}
        {selectedChatId && (
          <div className="fixed inset-0 z-50 bg-white md:hidden">
            <div className="h-full flex flex-col">
              <div className="p-2 border-b border-gray-200">
                <button 
                  onClick={() => setSelectedChatId(null)}
                  className="px-3 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
                >
                  ← Назад к списку
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatView 
                  chatId={selectedChatId} 
                  onChatDeleted={handleChatDeleted}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
