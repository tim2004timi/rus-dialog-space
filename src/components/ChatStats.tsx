import { useEffect, useState } from 'react';
import { getChatStats } from '@/lib/api';
import { MessageSquare, Send, CircleDot } from 'lucide-react';

const ChatStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    ai: 0
  });
  const [loading, setLoading] = useState(true);

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
          
        if (data.type === 'status_update' || data.chat) {
          // When we receive a chat update or status update, refresh the stats
          fetchStats();
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
