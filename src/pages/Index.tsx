import { useState } from 'react';
import ChatSidebar from '@/components/ChatSidebar';
import ChatView from '@/components/ChatView';
import ChatStats from '@/components/ChatStats';
import { useChat } from '@/contexts/ChatContext';

const Index = () => {
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);

  const handleSelectChat = (chatId: number) => {
    setSelectedChatId(chatId);
  };

  const handleChatDeleted = () => {
    setSelectedChatId(null);
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
          <ChatView 
            chatId={selectedChatId} 
            onChatDeleted={handleChatDeleted}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
