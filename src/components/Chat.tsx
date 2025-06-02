import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Message, WebSocketMessage } from '../types';

interface ChatProps {
  chatId: string;
  messages: Message[];
  onSendMessage: (message: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ chatId, messages, onSendMessage }) => {
  const [inputMessage, setInputMessage] = useState('');
  const { sendMessage, sendUpdate, lastMessage, lastUpdate, isMessagesConnected, isUpdatesConnected } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastMessage && lastMessage.chatId === chatId) {
      // Handle incoming message
      console.log('Received message:', lastMessage);
      // You might want to update the messages state here
    }
  }, [lastMessage, chatId]);

  useEffect(() => {
    if (lastUpdate) {
      // Handle incoming update
      console.log('Received update:', lastUpdate);
      // You might want to refresh the chat data here
    }
  }, [lastUpdate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const message: WebSocketMessage = {
        type: 'message',
        chatId,
        content: inputMessage,
        timestamp: new Date().toISOString()
      };
      
      sendMessage(message);
      onSendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleUpdate = (update: Partial<WebSocketMessage>) => {
    const fullUpdate: WebSocketMessage = {
      type: 'update',
      chatId,
      ...update
    };
    sendUpdate(fullUpdate);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.isBot
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
            disabled={!isMessagesConnected}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 focus:outline-none disabled:opacity-50"
            disabled={!isMessagesConnected || !inputMessage.trim()}
          >
            Send
          </button>
        </form>
        <div className="mt-2 text-sm text-gray-500">
          {!isMessagesConnected && (
            <span className="text-red-500">Messages connection lost. Reconnecting...</span>
          )}
          {!isUpdatesConnected && (
            <span className="text-red-500">Updates connection lost. Reconnecting...</span>
          )}
        </div>
      </div>
    </div>
  );
}; 