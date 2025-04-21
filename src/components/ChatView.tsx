
import { useState, useEffect, useRef } from 'react';
import { Message, Chat, getChatMessages, sendMessage, toggleAiChat, markChatAsRead } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Send } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface ChatViewProps {
  chatId: number | null;
}

const ChatView = ({ chatId }: ChatViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!chatId) return;
    
    try {
      setLoading(true);
      const messagesData = await getChatMessages(chatId);
      setMessages(messagesData);
      
      // Mark chat as read when opened
      await markChatAsRead(chatId);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      
      // Set up auto-refresh every 5 seconds
      const intervalId = setInterval(() => {
        fetchMessages();
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatId || !newMessage.trim()) return;
    
    try {
      await sendMessage(chatId, newMessage, aiEnabled);
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleAiToggle = async (checked: boolean) => {
    if (!chatId) return;
    
    try {
      setAiEnabled(checked);
      await toggleAiChat(chatId, checked);
      toast.success(checked ? 'ИИ включен для этого чата' : 'ИИ отключен для этого чата');
    } catch (error) {
      console.error('Failed to toggle AI status:', error);
      setAiEnabled(!checked); // Revert UI state on error
    }
  };

  // Format timestamp for display
  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (!chatId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <h3 className="text-xl font-medium text-gray-600 mb-2">Выберите чат</h3>
          <p className="text-gray-500">Выберите чат из списка слева чтобы начать общение</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="border-b border-gray-200 py-3 px-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-800">Чат #{chatId}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">ИИ</span>
          <Switch checked={aiEnabled} onCheckedChange={handleAiToggle} />
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center p-4">
            <p className="text-gray-500">Загрузка сообщений...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center p-4">
            <p className="text-gray-500">Нет сообщений</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите сообщение..."
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send size={18} className="mr-1" />
            Отправить
          </Button>
        </form>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isQuestion = message.message_type === 'question';
  
  return (
    <div className={`mb-4 flex ${isQuestion ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
        isQuestion ? 'bg-question text-gray-800' : 'bg-answer text-white'
      }`}>
        <div className="mb-1 flex items-center">
          {message.ai && (
            <div className="mr-1 text-xs px-1 py-0.5 bg-white/20 rounded">
              ИИ
            </div>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words">{message.message}</p>
        <div className="text-right mt-1">
          <span className={`text-xs ${isQuestion ? 'text-gray-500' : 'text-gray-300'}`}>
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
