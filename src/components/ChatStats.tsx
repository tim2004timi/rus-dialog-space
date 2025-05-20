import { useEffect, useState } from 'react';
import { getChatStats } from '@/lib/api';
import { wsManager } from '@/lib/websocket';
import { MessageSquare, Send, CircleDot, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatStats {
  total: number;
  pending: number;
  ai: number;
}

const ChatStats = () => {
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState(wsManager.getConnectionState());

  const fetchStats = async () => {
    try {
      console.log('[ChatStats] Fetching chat statistics');
      const data = await getChatStats();
      console.log('[ChatStats] Received statistics:', {
        total: data.total,
        pending: data.pending,
        ai: data.ai
      });
      setStats(data);
    } catch (error) {
      console.error('[ChatStats] Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = () => {
    console.log('[ChatStats] Manual reconnect requested');
    wsManager.forceReconnect();
  };

  useEffect(() => {
    console.log('[ChatStats] Initializing chat statistics');
    fetchStats();

    // Subscribe to WebSocket messages
    const unsubscribe = wsManager.subscribe((data) => {
      console.log('[ChatStats] Received WebSocket message:', {
        type: data.type,
        chatId: data.chat?.id,
        chatUuid: data.chat?.uuid,
        messageType: data.question?.message_type,
        rawData: data // Добавляем полные данные для отладки
      });
      
      if (data.type === 'status_update' || 
          data.type === 'ai_status_update' || 
          data.type === 'new_message') {
        console.log('[ChatStats] Updating stats due to:', {
          type: data.type,
          chatId: data.chat?.id,
          chatUuid: data.chat?.uuid
        });
        fetchStats();
      }
    });

    // Check WebSocket status periodically
    const statusInterval = setInterval(() => {
      const newStatus = wsManager.getConnectionState();
      if (newStatus !== wsStatus) {
        console.log('[ChatStats] WebSocket status changed:', newStatus);
        setWsStatus(newStatus);
      }
    }, 1000);

    return () => {
      console.log('[ChatStats] Cleaning up chat statistics');
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [wsStatus]);

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
              <p className="text-sm font-medium">{stats?.total}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <CircleDot size={18} className="text-unread mr-2" />
            <div>
              <p className="text-xs text-gray-500">Ожидают ответа</p>
              <p className="text-sm font-medium">{stats?.pending}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 bg-aiHighlight/20 rounded-sm flex items-center justify-center text-aiHighlight text-xs font-bold mr-2">
              A
            </div>
            <div>
              <p className="text-xs text-gray-500">ИИ чаты</p>
              <p className="text-sm font-medium">{stats?.ai}</p>
            </div>
          </div>

          <div className="flex items-center ml-auto space-x-4">
            <div className="flex items-center">
              {wsStatus === 'connected' ? (
                <Wifi size={18} className="text-green-500 mr-2" />
              ) : (
                <WifiOff size={18} className="text-red-500 mr-2" />
              )}
              <div>
                <p className="text-xs text-gray-500">WebSocket</p>
                <p className="text-sm font-medium">{wsStatus}</p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReconnect}
              className="flex items-center space-x-1"
            >
              <RefreshCw size={16} className={wsStatus === 'connected' ? 'text-green-500' : 'text-red-500'} />
              <span className="text-xs">Переподключить</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatStats;
