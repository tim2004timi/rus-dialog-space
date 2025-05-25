import { useState, useEffect, useRef } from 'react';
import ChatSidebar from '@/components/ChatSidebar';
import ChatView from '@/components/ChatView';
import ChatStats from '@/components/ChatStats';
import { getChats } from '@/lib/api';

const Index = () => {
  const [selectedChatId, setSelectedChatIdRaw] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<number[]>([]);
  const selectedChatIdRef = useRef<number | null>(null);

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
    setChatIds(ids);
    console.log('Fetched chat IDs:', ids, 'Current selectedChatId:', selectedChatIdRef.current);
    // If selectedChatId is not in the new list, just clear it
    if (selectedChatIdRef.current !== null && !ids.includes(selectedChatIdRef.current)) {
      setSelectedChatId(null);
    }
  };

  useEffect(() => {
    fetchAndSyncChats();
  }, []);

  const handleSelectChat = (chatId: number) => {
    console.log('handleSelectChat called with:', chatId);
    if (chatId !== null && !chatIds.includes(chatId)) {
      console.warn('Attempted to set invalid selectedChatId:', chatId, 'Valid chatIds:', chatIds, new Error().stack);
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

  // Add WebSocket connection for chat read status
  useEffect(() => {
    let ws: WebSocket | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      ws = new WebSocket('ws://localhost:3002');
      
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'frontend' }));
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    // Set up interval to send read status
    const startReadStatusInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      intervalId = setInterval(() => {
        const currentChatId = selectedChatIdRef.current;
        if (currentChatId !== null && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'mark_chat_read',
            chatId: currentChatId
          }));
        }
      }, 3000);
    };

    // Start interval when a chat is selected
    if (selectedChatId !== null) {
      startReadStatusInterval();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [selectedChatId]);

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
