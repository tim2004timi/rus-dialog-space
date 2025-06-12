import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Chat, getChatMessages, sendMessage as apiSendMessage, toggleAiChat, markChatAsRead, deleteChat, API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Send, Trash2, Paperclip } from 'lucide-react';
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
import { useChat } from '@/contexts/ChatContext';
import { ChatTags } from '@/components/ChatTags';

interface ChatViewProps {
  chatId: number | null;
  onChatDeleted?: () => void;
}

const ChatView = ({ chatId, onChatDeleted }: ChatViewProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage: wsSendMessage } = useWebSocket();
  const { messages, loading: chatContextLoading, selectedChat, markChatAsRead: markChatAsReadFromContext, refreshChats, sendMessage } = useChat();

  console.log('ChatView rendering with chatId:', chatId, 'messages from context:', messages.length);

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

  const fetchChatInfo = useCallback(async () => {
    if (!chatId) return;
    setError(null);
    try {
      // Fetch chat info directly if chatId is available
      const response = await fetch(`${API_URL}/chats/${chatId}`);
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || 'Чат не найден или недоступен.');
          setChatInfo(null);
          return;
        }
      const chatData = await response.json();
      setAiEnabled(chatData.ai);
      setChatInfo(chatData);

      // Fetch all messages for the chat when chat info is loaded
      const messagesData = await getChatMessages(chatData.id); // Fetch all messages
      // Note: messages are added to context state via selectChat, not here directly

    } catch (error) {
      setError('Ошибка при загрузке чата.');
      setChatInfo(null);
      console.error('Failed to fetch chat info:', error, 'chatId:', chatId);
    }
  }, [chatId]);

  useEffect(() => {
    console.log('ChatView effect: chatId changed to', chatId);
    // When chatId changes, fetch chat info and messages
    if (chatId) {
      fetchChatInfo();
      // Messages are now loaded by ChatContext when selectChat is called.
      // Ensure selectChat is called in the parent component when chatId changes.

    } else {
      setChatInfo(null);
    }
  }, [chatId, fetchChatInfo]);

  // Send waiting=false periodically when chat is open
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (chatId) {
      // Send immediately on chat open
      markChatAsReadFromContext(chatId);

      // Set interval for subsequent calls
      intervalId = setInterval(() => {
        console.log(`Marking chat ${chatId} as read periodically...`);
        markChatAsReadFromContext(chatId);
      }, 3000); // Send every 3 seconds
    }

    // Cleanup function to clear interval
    return () => {
      console.log(`Clearing interval for chat ${chatId}`);
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [chatId, markChatAsReadFromContext]); // Re-run effect if chatId or markChatAsReadFromContext changes

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
    try {
      await sendMessage(newMessage);
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
      fetchChatInfo();
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('chat_id', selectedChat.id.toString());

      const response = await fetch(`${API_URL}/messages/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setNewMessage('');
      toast.success('Изображение отправлено');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Не удалось отправить изображение');
    }
  };

  useEffect(() => {
    if (selectedChat && selectedChat.id === chatId) {
      setChatInfo(selectedChat);
      setAiEnabled(selectedChat.ai);
    }
  }, [selectedChat, chatId]);

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

  const displayLoading = chatContextLoading && messages.length === 0;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="border-b border-gray-300 py-2 px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-4 flex-grow">
          <h2 className="text-lg font-medium text-gray-800 truncate">
            {chatInfo?.name || `Чат #${chatId}`}
          </h2>
          {chatInfo && (
            <ChatTags
              chatId={chatInfo.id}
              tags={chatInfo.tags || []}
              onTagsUpdate={(newTags) => {
                setChatInfo(prev => prev ? { ...prev, tags: newTags } : null);
              }}
            />
          )}
        </div>
        <div className="flex items-center space-x-4 flex-shrink-0">
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
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 messages-container" ref={messagesContainerRef}>
        {displayLoading ? (
          <div className="flex justify-center p-4">
            <p className="text-gray-500">Загрузка сообщений...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center p-4">
            <p className="text-gray-500">Нет сообщений</p>
          </div>
        ) : (
          <>
            {[...messages]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((message, index) => (
                <MessageBubble 
                  key={message.id || index}
                  message={message} 
                  formatTime={formatMessageTime}
                />
              ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <div className="relative flex-1">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 border-gray-300 pr-10"
              autoComplete="off"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} className="text-gray-500" />
            </Button>
          </div>
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
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (message.is_image && imageRef.current) {
      imageRef.current.onload = () => {
        // Scroll to bottom after image loads
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      };
    }
  }, [message.is_image]);

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
        {message.is_image ? (
          <img 
            ref={imageRef}
            src={message.message} 
            alt="Uploaded image" 
            className="max-w-full rounded-lg"
            style={{ maxHeight: '300px' }}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.message}</p>
        )}
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
