type WebSocketMessageHandler = (data: any) => void;

class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private messageHandlers: Set<WebSocketMessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private isConnecting = false;
  private serverUrl = 'ws://localhost:3002';

  private constructor() {
    console.log('[WebSocketManager] Initializing WebSocket manager');
    this.connect();
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private connect() {
    if (this.isConnecting) {
      console.log('[WebSocketManager] Already attempting to connect');
      return;
    }

    try {
      this.isConnecting = true;
      console.log('[WebSocketManager] Attempting to connect to WebSocket at', this.serverUrl);
      
      // Close existing connection if any
      if (this.ws) {
        console.log('[WebSocketManager] Closing existing connection');
        this.ws.close();
        this.ws = null;
      }

      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('[WebSocketManager] WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // Send initial message to identify as frontend
        const initMessage = { type: 'frontend' };
        console.log('[WebSocketManager] Sending initial message:', initMessage);
        this.ws?.send(JSON.stringify(initMessage));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocketManager] Received message:', {
            type: data.type,
            chatId: data.chat?.id,
            chatUuid: data.chat?.uuid,
            messageType: data.question?.message_type,
            aiStatus: data.chat?.ai,
            waitingStatus: data.chat?.waiting,
            rawData: data
          });
          this.messageHandlers.forEach(handler => handler(data));
        } catch (e) {
          console.error('[WebSocketManager] Error parsing WebSocket message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocketManager] WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.isConnecting = false;
        this.ws = null;
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocketManager] WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('[WebSocketManager] Error creating WebSocket connection:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocketManager] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectTimeout * this.reconnectAttempts);
    } else {
      console.error('[WebSocketManager] Max reconnection attempts reached');
    }
  }

  public subscribe(handler: WebSocketMessageHandler) {
    console.log('[WebSocketManager] New subscriber added');
    this.messageHandlers.add(handler);
    return () => {
      console.log('[WebSocketManager] Subscriber removed');
      this.messageHandlers.delete(handler);
    };
  }

  public send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketManager] Sending message:', {
        type: message.type,
        chatId: message.chat?.id,
        chatUuid: message.chat?.uuid,
        messageType: message.question?.message_type,
        aiStatus: message.chat?.ai,
        waitingStatus: message.chat?.waiting,
        rawMessage: message
      });
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocketManager] Cannot send message - WebSocket is not connected. Current state:', this.ws?.readyState);
      // Try to reconnect if not already connecting
      if (!this.isConnecting) {
        console.log('[WebSocketManager] Attempting to reconnect before sending message');
        this.connect();
      }
    }
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }

  public forceReconnect() {
    console.log('[WebSocketManager] Forcing reconnection');
    this.reconnectAttempts = 0;
    this.connect();
  }
}

export const wsManager = WebSocketManager.getInstance(); 