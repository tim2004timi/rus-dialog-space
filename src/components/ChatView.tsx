import { useState, useEffect, useRef } from 'react';
import { Message, Chat, getChatMessages, sendMessage, toggleAiChat, markChatAsRead, deleteChat, API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Send, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWebSocket } from '@/contexts/WebSocketContext';

interface ChatViewProps {
  chatId: number | null;
  onChatDeleted?: () => void;
}

const ChatView = ({ chatId, onChatDeleted }: ChatViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { lastMessage, sendMessage: wsSendMessage } = useWebSocket();

  console.log('ChatView rendering with chatId:', chatId);

  // Format timestamp for display
  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '');
  };

  const fetchChatInfo = async () => {
    if (!chatId) return;
    setError(null);
    try {
      // First try to get chat by ID
      const chatResponse = await fetch(`${API_URL}/chats/${chatId}`);
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        setAiEnabled(chatData.ai);
        setChatInfo(chatData);
      } else {
        if (chatResponse.status === 400 || chatResponse.status === 404) {
          setError('Чат не найден или недоступен.');
          setChatInfo(null);
          setMessages([]);
          return;
        }
        // If not found by ID, try to get chat by UUID
        const chatsResponse = await fetch(`${API_URL}/chats`);
        if (chatsResponse.ok) {
          const chats = await chatsResponse.json();
          const chat = chats.find((c: Chat) => 
            c.id === Number(chatId) || c.uuid === String(chatId)
          );
          if (chat) {
            setAiEnabled(chat.ai);
            setChatInfo(chat);
          } else {
            setError('Чат не найден или недоступен.');
            setChatInfo(null);
            setMessages([]);
          }
        }
      }
    } catch (error) {
      setError('Ошибка при загрузке чата.');
      setChatInfo(null);
      setMessages([]);
      console.error('Failed to fetch chat info:', error, 'chatId:', chatId);
    }
  };

  const fetchMessages = async () => {
    if (!chatId) return;
    setError(null);
    try {
      setLoading(true);
      let messagesData;
      let chatData;
      // First try to get chat by ID
      const chatResponse = await fetch(`${API_URL}/chats/${chatId}`);
      if (chatResponse.ok) {
        chatData = await chatResponse.json();
        messagesData = await getChatMessages(chatData.id);
      } else {
        if (chatResponse.status === 400 || chatResponse.status === 404) {
          setError('Чат не найден или недоступен.');
          setChatInfo(null);
          setMessages([]);
          return;
        }
        // If not found by ID, try to get chat by UUID
        const chatsResponse = await fetch(`${API_URL}/chats`);
        if (chatsResponse.ok) {
          const chats = await chatsResponse.json();
          chatData = chats.find((c: Chat) => 
            c.id === Number(chatId) || c.uuid === String(chatId)
          );
          if (chatData) {
            messagesData = await getChatMessages(chatData.id);
          } else {
            setError('Чат не найден или недоступен.');
            setChatInfo(null);
            setMessages([]);
            return;
          }
        }
      }
      if (messagesData) {
        // Сортируем сообщения по времени и типу
        const sortedMessages = messagesData.sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          
          // Если время одинаковое, вопрос должен быть выше ответа
          if (timeA === timeB) {
            return a.message_type === 'question' ? -1 : 1;
          }
          
          return timeA - timeB;
        });
        
        setMessages(sortedMessages);
        
        // Update chat info
        if (chatData) {
          setAiEnabled(chatData.ai);
          setChatInfo(chatData);
        }
        
        // Mark chat as read when opened
        console.log('Marking chat as read after fetching messages:', chatId);
        await markChatAsRead(chatId);
      }
    } catch (error) {
      setError('Ошибка при загрузке сообщений.');
      setChatInfo(null);
      setMessages([]);
      console.error('Failed to fetch messages:', error, 'chatId:', chatId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('ChatView effect: chatId:', chatId, 'chatInfo:', chatInfo);
    if (chatId) {
      fetchMessages();
    }
  }, [chatId]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.chat && lastMessage.chat.id === chatId) {
      console.log('lastMessage:', lastMessage);
      console.log('current messages:', messages);
      // Improved duplicate check: by id, created_at, and message
      if (lastMessage.question) {
        setMessages(prev => {
          const exists = prev.some(
            m => m.id === lastMessage.question.id ||
                 (m.created_at === lastMessage.question.created_at && m.message === lastMessage.question.message)
          );
          if (exists) return prev;
          const newMsg: Message = {
            id: lastMessage.question.id,
            chat_id: lastMessage.chat.id,
            created_at: lastMessage.question.created_at,
            message: lastMessage.question.message,
            message_type: 'question' as const,
            ai: false
          };
          let updated = [...prev, newMsg];
          if (lastMessage.answer) {
            const existsAns = prev.some(m => m.id === lastMessage.answer.id || (m.created_at === lastMessage.answer.created_at && m.message === lastMessage.answer.message));
            if (!existsAns) {
              const answerMsg: Message = {
                id: lastMessage.answer.id,
                chat_id: lastMessage.chat.id,
                created_at: lastMessage.answer.created_at,
                message: lastMessage.answer.message,
                message_type: 'answer' as const,
                ai: !!lastMessage.answer.ai
              };
              updated.push(answerMsg);
            }
          }
          // Sort by time and type
          return updated.sort((a, b) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            if (timeA === timeB) {
              return a.message_type === 'question' ? -1 : 1;
            }
            return timeA - timeB;
          });
        });
        setAiEnabled(lastMessage.chat.ai);
        setChatInfo((prev) => prev ? { ...prev, ai: lastMessage.chat.ai, waiting: lastMessage.chat.waiting } : lastMessage.chat);
      }
    }
  }, [lastMessage, chatId, messages]);

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
      const savedMessage = await sendMessage(chatId, newMessage, false);
      setMessages(prev => [...prev, savedMessage]);
      setChatInfo(prev => prev ? { ...prev, waiting: true } : null);
      wsSendMessage({ chat_id: chatInfo?.uuid, message: newMessage });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Не удалось отправить сообщение');
    }
  };

  const handleAiToggle = async (checked: boolean) => {
    if (!chatId) return;
    
    try {
      console.log('Toggling AI status:', { chatId, checked });
      const updatedChat = await toggleAiChat(chatId, checked);
      console.log('AI status updated:', updatedChat);
      setAiEnabled(updatedChat.ai);
      toast.success(checked ? 'ИИ включен для этого чата' : 'ИИ отключен для этого чата');
    } catch (error) {
      console.error('Failed to toggle AI status:', error);
      // Revert UI state on error
      await fetchChatInfo();
    }
  };

  const handleDeleteChat = async () => {
    if (!chatId) return;
    
    try {
      await deleteChat(chatId);
      toast.success('Чат успешно удален');
      if (onChatDeleted) {
        onChatDeleted();
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
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

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <h3 className="text-xl font-medium text-red-600 mb-2">{error}</h3>
          <p className="text-gray-500">Попробуйте выбрать другой чат или обновить страницу.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="border-b border-gray-300 py-3 px-4 flex justify-between items-center h-14">
        <div>
          <h2 className="text-lg font-medium text-gray-800">Чат #{chatId}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">ИИ</span>
            <Switch checked={aiEnabled} onCheckedChange={handleAiToggle} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 size={18} />
          </Button>
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
              formatTime={formatMessageTime}
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
            className="flex-1 border-gray-300"
            autoComplete="off"
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send size={18} className="mr-1" />
            Отправить
          </Button>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Это навсегда удалит чат и все его сообщения.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-red-500 hover:bg-red-600"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  formatTime: (timestamp: string) => string;
}

const MessageBubble = ({ message, formatTime }: MessageBubbleProps) => {
  const isQuestion = message.message_type === 'question';
  
  return (
    <div className={`mb-4 flex ${isQuestion ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
        isQuestion ? 'bg-gray-300 text-gray-800' : 'bg-[#1F1F1F] text-white'
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
            {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
