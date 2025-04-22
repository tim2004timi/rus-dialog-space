import { useState, useEffect } from 'react';
import ChatSidebar from '@/components/ChatSidebar';
import ChatView from '@/components/ChatView';
import ChatStats from '@/components/ChatStats';

const Index = () => {
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);

  const handleSelectChat = (chatId: number) => {
    setSelectedChatId(chatId);
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
            />
          </div>
        </div>
        
        {/* Main Content (70% width) */}
        <div className="hidden md:block md:w-2/3 lg:w-7/10 flex-1 border-l border-gray-200">
          <ChatView chatId={selectedChatId} />
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
                <ChatView chatId={selectedChatId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
