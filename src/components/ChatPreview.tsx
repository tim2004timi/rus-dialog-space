interface ChatPreviewProps {
  chat: {
    id: number;
    uuid: string;
    waiting: boolean;
    ai: boolean;
    lastMessage?: string;
    lastMessageTime?: string;
    name?: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

const ChatPreview = ({ chat, isSelected, onClick }: ChatPreviewProps) => {
  console.log('Rendering ChatPreview for chat:', chat.uuid, 'waiting:', chat.waiting);
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
          {chat.uuid.charAt(0).toUpperCase()}
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