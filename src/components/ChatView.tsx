import { useState, useEffect, useRef } from 'react';
import { Message, Chat, getChatMessages, sendMessage, toggleAiChat, markChatAsRead, API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Send } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { wsManager } from '@/lib/websocket';

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
    
    try {
      // First try to get chat by ID
      const chatResponse = await fetch(`${API_URL}/chats/${chatId}`);
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        console.log('Fetched chat info:', chatData);
        setAiEnabled(chatData.ai);
        setChatInfo(chatData);
      } else {
        // If not found by ID, try to get chat by UUID
        const chatsResponse = await fetch(`${API_URL}/chats`);
        if (chatsResponse.ok) {
          const chats = await chatsResponse.json();
          const chat = chats.find((c: Chat) => 
            c.id === Number(chatId) || c.uuid === String(chatId)
          );
          if (chat) {
            console.log('Found chat by UUID:', chat);
            setAiEnabled(chat.ai);
            setChatInfo(chat);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch chat info:', error);
    }
  };

  const fetchMessages = async () => {
    if (!chatId) return;
    
    try {
      setLoading(true);
      console.log('Fetching messages for chat:', chatId);
      
      // First try to get messages by ID
      let messagesData;
      try {
        messagesData = await getChatMessages(chatId);
      } catch (error) {
        // If failed, try to get chat by UUID first
        const chatsResponse = await fetch(`${API_URL}/chats`);
        if (chatsResponse.ok) {
          const chats = await chatsResponse.json();
          const chat = chats.find((c: Chat) => 
            c.id === Number(chatId) || c.uuid === String(chatId)
          );
          if (chat) {
            messagesData = await getChatMessages(chat.id);
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
        
        // Get chat info to set initial AI status
        await fetchChatInfo();
        
        // Mark chat as read when opened
        console.log('Marking chat as read after fetching messages:', chatId);
        await markChatAsRead(chatId);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatId) {
      console.log('[ChatView] Initializing chat view for chatId:', chatId);
      fetchMessages();

      // Subscribe to WebSocket messages
      const unsubscribe = wsManager.subscribe((data) => {
        console.log('[ChatView] Received WebSocket message:', {
          type: data.type,
          chatId: data.chat?.id,
          chatUuid: data.chat?.uuid,
          currentChatId: chatId,
          currentChatUuid: chatInfo?.uuid,
          rawData: data
        });

        if (data.type === 'ai_status_update' && data.chat) {
          console.log('[ChatView] Processing AI status update:', {
            chatId: data.chat.id,
            chatUuid: data.chat.uuid,
            ai: data.chat.ai,
            currentChatId: chatId
          });
          
          if (data.chat.id === chatId || data.chat.uuid === chatInfo?.uuid) {
            console.log('[ChatView] Updating AI status for current chat');
            setAiEnabled(data.chat.ai);
            setChatInfo(prev => prev ? { ...prev, ai: data.chat.ai } : data.chat);
          }
        } else if (data.chat && data.question) {
          // Проверяем, что это нужный чат
          if (data.chat.id === chatId || data.chat.uuid === chatInfo?.uuid) {
            console.log('[ChatView] Updating chat with new message:', {
              chatId: data.chat.id,
              messageType: data.question.message_type,
              aiStatus: data.chat.ai,
              waitingStatus: data.chat.waiting
            });

            // Обновляем сообщения
            let newMessages = [];
            if (data.answer) {
              newMessages = [
                {
                  id: data.question.id,
                  chat_id: data.chat.id,
                  created_at: data.question.created_at,
                  message: data.question.message,
                  message_type: 'question',
                  ai: false
                },
                {
                  id: data.answer.id,
                  chat_id: data.chat.id,
                  created_at: data.answer.created_at,
                  message: data.answer.message,
                  message_type: 'answer',
                  ai: !!data.answer.ai
                }
              ];
            } else {
              newMessages = [
                {
                  id: data.question.id,
                  chat_id: data.chat.id,
                  created_at: data.question.created_at,
                  message: data.question.message,
                  message_type: 'question',
                  ai: false
                }
              ];
            }

            setMessages((prev) => {
              const filtered = prev.filter(m => m.chat_id !== data.chat.id);
              const updated = [...filtered, ...newMessages].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              console.log('[ChatView] Updated messages:', {
                previousCount: prev.length,
                newCount: updated.length,
                newMessagesCount: newMessages.length
              });
              return updated;
            });

            setAiEnabled(data.chat.ai);
            setChatInfo((prev) => {
              const updated = prev ? { ...prev, ai: data.chat.ai, waiting: data.chat.waiting } : data.chat;
              console.log('[ChatView] Updated chat info:', {
                previousAi: prev?.ai,
                newAi: updated.ai,
                previousWaiting: prev?.waiting,
                newWaiting: updated.waiting
              });
              return updated;
            });
          }
        }
      });

      return () => {
        console.log('[ChatView] Cleaning up chat view for chatId:', chatId);
        unsubscribe();
      };
    }
  }, [chatId, chatInfo?.uuid]);

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
      // Save message to database
      const savedMessage = await sendMessage(chatId, newMessage, false);
      
      // Update messages list
      setMessages(prev => [...prev, savedMessage]);
      
      // Update chat info
      setChatInfo(prev => prev ? { ...prev, waiting: true } : null);
      
      // Send to WebSocket for Telegram bot
      const ws = new WebSocket('ws://localhost:3002');
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'frontend' }));
        ws.send(JSON.stringify({ chat_id: chatInfo?.uuid, message: newMessage }));
        ws.close();
      };
      
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Не удалось отправить сообщение');
    }
  };

  const handleAiToggle = async (checked: boolean) => {
    if (!chatId) return;
    
    try {
      console.log('[ChatView] Toggling AI status:', { chatId, checked, currentAiStatus: aiEnabled });
      const updatedChat = await toggleAiChat(chatId, checked);
      console.log('[ChatView] AI status updated from server:', updatedChat);
      
      // Update local state immediately
      setAiEnabled(updatedChat.ai);
      setChatInfo(prev => prev ? { ...prev, ai: updatedChat.ai } : updatedChat);
      
      // Send WebSocket update
      const wsMessage = { 
        type: 'ai_status_update',
        chat: {
          id: updatedChat.id,
          uuid: updatedChat.uuid,
          ai: updatedChat.ai,
          waiting: updatedChat.waiting
        }
      };
      console.log('[ChatView] Sending WebSocket update:', wsMessage);
      wsManager.send(wsMessage);
      
      // Force update chat list
      const chatsResponse = await fetch(`${API_URL}/chats`);
      if (chatsResponse.ok) {
        const chats = await chatsResponse.json();
        const updatedChatData = chats.find((c: Chat) => c.id === chatId || c.uuid === String(chatId));
        if (updatedChatData) {
          console.log('[ChatView] Updated chat data from server:', updatedChatData);
          setChatInfo(updatedChatData);
        }
      }
      
      toast.success(checked ? 'ИИ включен для этого чата' : 'ИИ отключен для этого чата');
    } catch (error) {
      console.error('[ChatView] Failed to toggle AI status:', error);
      // Revert UI state on error
      await fetchChatInfo();
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="border-b border-gray-300 py-3 px-4 flex justify-between items-center h-14">
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
