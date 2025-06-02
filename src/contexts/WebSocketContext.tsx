import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketMessage } from '../types';

interface WebSocketContextType {
  sendMessage: (message: WebSocketMessage) => void;
  sendUpdate: (update: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  lastUpdate: WebSocketMessage | null;
  isMessagesConnected: boolean;
  isUpdatesConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messagesWs, setMessagesWs] = useState<WebSocket | null>(null);
  const [updatesWs, setUpdatesWs] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [lastUpdate, setLastUpdate] = useState<WebSocketMessage | null>(null);
  const [isMessagesConnected, setIsMessagesConnected] = useState(false);
  const [isUpdatesConnected, setIsUpdatesConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const messageQueue = useRef<WebSocketMessage[]>([]);
  const updateQueue = useRef<WebSocketMessage[]>([]);
  const messagesWsRef = useRef<WebSocket | null>(null);
  const updatesWsRef = useRef<WebSocket | null>(null);

  const connectMessagesWebSocket = useCallback(() => {
    if (messagesWsRef.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket('ws://localhost:3001/ws/messages');
    messagesWsRef.current = socket;
    
    socket.onopen = () => {
      console.log('Messages WebSocket connected');
      setIsMessagesConnected(true);
      reconnectAttempts.current = 0;
      
      // Send queued messages
      while (messageQueue.current.length > 0) {
        const message = messageQueue.current.shift();
        if (message) {
          socket.send(JSON.stringify(message));
        }
      }
    };

    socket.onclose = () => {
      console.log('Messages WebSocket disconnected');
      setIsMessagesConnected(false);
      messagesWsRef.current = null;
      
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;
        setTimeout(connectMessagesWebSocket, RECONNECT_DELAY);
      } else {
        console.error('Max reconnection attempts reached for messages');
      }
    };

    socket.onerror = (error) => {
      console.error('Messages WebSocket error:', error);
    };

    socket.onmessage = async (event) => {
      try {
        const data = event.data instanceof Blob 
          ? JSON.parse(await event.data.text())
          : JSON.parse(event.data);
        console.log('[WebSocketContext] Received message:', data);
        setLastMessage(data as WebSocketMessage);
      } catch (e) {
        console.error('Messages WebSocket message parse error:', e);
      }
    };

    setMessagesWs(socket);
  }, []);

  const connectUpdatesWebSocket = useCallback(() => {
    if (updatesWsRef.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket('ws://localhost:3001/ws/updates');
    updatesWsRef.current = socket;
    
    socket.onopen = () => {
      console.log('Updates WebSocket connected');
      setIsUpdatesConnected(true);
      reconnectAttempts.current = 0;
      
      // Send queued updates
      while (updateQueue.current.length > 0) {
        const update = updateQueue.current.shift();
        if (update) {
          socket.send(JSON.stringify(update));
        }
      }
    };

    socket.onclose = () => {
      console.log('Updates WebSocket disconnected');
      setIsUpdatesConnected(false);
      updatesWsRef.current = null;
      
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;
        setTimeout(connectUpdatesWebSocket, RECONNECT_DELAY);
      } else {
        console.error('Max reconnection attempts reached for updates');
      }
    };

    socket.onerror = (error) => {
      console.error('Updates WebSocket error:', error);
    };

    socket.onmessage = async (event) => {
      try {
        const data = event.data instanceof Blob 
          ? JSON.parse(await event.data.text())
          : JSON.parse(event.data);
        console.log('[WebSocketContext] Received update:', data);
        setLastUpdate(data as WebSocketMessage);
      } catch (e) {
        console.error('Updates WebSocket message parse error:', e);
      }
    };

    setUpdatesWs(socket);
  }, []);

  useEffect(() => {
    connectMessagesWebSocket();
    connectUpdatesWebSocket();
    return () => {
      if (messagesWsRef.current) {
        messagesWsRef.current.close();
      }
      if (updatesWsRef.current) {
        updatesWsRef.current.close();
      }
    };
  }, [connectMessagesWebSocket, connectUpdatesWebSocket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (messagesWsRef.current?.readyState === WebSocket.OPEN) {
      messagesWsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for later
      messageQueue.current.push(message);
      // Try to reconnect if not already connected
      if (!isMessagesConnected) {
        connectMessagesWebSocket();
      }
    }
  }, [isMessagesConnected, connectMessagesWebSocket]);

  const sendUpdate = useCallback((update: WebSocketMessage) => {
    if (updatesWsRef.current?.readyState === WebSocket.OPEN) {
      updatesWsRef.current.send(JSON.stringify(update));
    } else {
      // Queue update for later
      updateQueue.current.push(update);
      // Try to reconnect if not already connected
      if (!isUpdatesConnected) {
        connectUpdatesWebSocket();
      }
    }
  }, [isUpdatesConnected, connectUpdatesWebSocket]);

  return (
    <WebSocketContext.Provider 
      value={{ 
        sendMessage, 
        sendUpdate, 
        lastMessage, 
        lastUpdate, 
        isMessagesConnected, 
        isUpdatesConnected 
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}; 