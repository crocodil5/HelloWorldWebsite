import { useEffect, useRef, useState } from 'react';

interface UseWebSocketOptions {
  contextData: string;
  onRedirect?: (url: string) => void;
}

export const useWebSocket = ({ contextData, onRedirect }: UseWebSocketOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);

  const createConnection = () => {
    if (!contextData) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?context_data=${contextData}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('🔗 WebSocket connected for user:', contextData.substring(0, 8) + '...');
        setReconnectAttempts(0); // Reset reconnect attempts on successful connection
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'redirect' && data.url) {
            console.log('📤 Redirect command received:', data.url);
            
            // Execute redirect
            if (data.url.startsWith('http')) {
              // External redirect
              window.location.href = data.url;
            } else {
              // Internal redirect
              window.location.href = data.url;
            }
            
            // Call callback if provided
            if (onRedirect) {
              onRedirect(data.url);
            }
          } else if (data.type === 'refresh') {
            console.log('🔄 Refresh command received:', data.message);
            
            // Refresh the current page
            window.location.reload();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log('❌ WebSocket disconnected', event.code, event.reason);
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30 seconds
          console.log(`🔄 Attempting to reconnect in ${timeout}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectInterval.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            createConnection();
          }, timeout);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  useEffect(() => {
    createConnection();

    // Cleanup on unmount
    return () => {
      if (reconnectInterval.current) {
        clearTimeout(reconnectInterval.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [contextData]);

  return wsRef.current;
};