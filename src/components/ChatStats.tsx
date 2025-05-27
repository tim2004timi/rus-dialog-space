import { useEffect, useState } from 'react';
import { getChatStats } from '@/lib/api';
import { MessageSquare, Send, CircleDot } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';

const ChatStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    ai: 0
  });
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  const fetchStats = async () => {
    try {
      const statsData = await getChatStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    // Handle stats updates from WebSocket here if needed
    // For example, you can refetch stats or update state based on lastMessage
  }, [lastMessage]);

  return (
    <div className="bg-white border-b border-gray-300 py-3 px-4 flex items-center h-14">
      {loading ? (
        <div className="text-sm text-gray-500">Загрузка статистики...</div>
      ) : (
        <div className="flex space-x-6 w-full">
          <div className="flex items-center">
            <MessageSquare size={18} className="text-gray-500 mr-2" />
            <div>
              <p className="text-xs text-gray-500">Всего чатов</p>
              <p className="text-sm font-medium">{stats.total}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <CircleDot size={18} className="text-unread mr-2" />
            <div>
              <p className="text-xs text-gray-500">Ожидают ответа</p>
              <p className="text-sm font-medium">{stats.pending}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 bg-aiHighlight/20 rounded-sm flex items-center justify-center text-aiHighlight text-xs font-bold mr-2">
              A
            </div>
            <div>
              <p className="text-xs text-gray-500">ИИ чаты</p>
              <p className="text-sm font-medium">{stats.ai}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatStats;
