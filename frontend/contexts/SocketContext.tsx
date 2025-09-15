'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const connectSocket = () => {
    if (socket?.connected) {
      return;
    }

    setIsConnecting(true);

    const token = localStorage.getItem('token');
    if (!token) {
      setIsConnecting(false);
      return;
    }

    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setIsConnecting(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      setIsConnecting(false);
    });

    // Global events
    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      toast.error(error.message || 'Connection error');
    });

    // Transaction events
    newSocket.on('transaction_completed', (data) => {
      console.log('Transaction completed:', data);
      toast.success(`Transaction ${data.type === 'send' ? 'sent' : 'received'}: ${data.currency} ${data.amount}`);
    });

    newSocket.on('transaction_failed', (data) => {
      console.log('Transaction failed:', data);
      toast.error(`Transaction failed: ${data.reason}`);
    });

    // Balance events
    newSocket.on('balance_updated', (data) => {
      console.log('Balance updated:', data);
      // You can dispatch a custom event or update context here
      window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: data }));
    });

    // Payment request events
    newSocket.on('payment_request_received', (data) => {
      console.log('Payment request received:', data);
      toast.success(`Payment request from ${data.fromUser.firstName} ${data.fromUser.lastName}: ${data.currency} ${data.amount}`);
    });

    newSocket.on('payment_request_sent', (data) => {
      console.log('Payment request sent:', data);
      toast.success('Payment request sent successfully');
    });

    newSocket.on('payment_response_received', (data) => {
      console.log('Payment response received:', data);
      if (data.accepted) {
        toast.success('Payment request accepted');
      } else {
        toast.error('Payment request declined');
      }
    });

    // AI Chat events
    newSocket.on('ai_chat_response', (data) => {
      console.log('AI chat response:', data);
      // Handle AI chat response
      window.dispatchEvent(new CustomEvent('aiChatResponse', { detail: data }));
    });

    newSocket.on('ai_chat_error', (data) => {
      console.log('AI chat error:', data);
      toast.error('AI chat error: ' + data.message);
    });

    // Location events
    newSocket.on('location_updated', (data) => {
      console.log('Location updated:', data);
      if (data.success) {
        toast.success('Location updated successfully');
      }
    });

    // QR Code events
    newSocket.on('qr_generated', (data) => {
      console.log('QR code generated:', data);
      window.dispatchEvent(new CustomEvent('qrGenerated', { detail: data }));
    });

    // Fraud detection events
    newSocket.on('fraud_alert', (data) => {
      console.log('Fraud alert:', data);
      toast.error(`🚨 Fraud Alert: ${data.message}`);
    });

    // System events
    newSocket.on('system_maintenance', (data) => {
      console.log('System maintenance:', data);
      toast.error(`System maintenance: ${data.message}`);
    });

    newSocket.on('system_update', (data) => {
      console.log('System update:', data);
      toast.success(`System updated: ${data.message}`);
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  const emit = (event: string, data: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    isConnecting,
    emit,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}