import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '@/middleware/auth';
import { UserService } from '@/services/userService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export const initializeSocket = (app: express.Application): HttpServer => {
  const server = new HttpServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);
      const user = await UserService.getUserById(decoded.userId);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = decoded.userId;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 User ${socket.userId} connected via Socket.IO`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Handle wallet balance updates
    socket.on('subscribe_wallet_updates', () => {
      socket.join(`wallet:${socket.userId}`);
    });

    // Handle transaction updates
    socket.on('subscribe_transaction_updates', () => {
      socket.join(`transactions:${socket.userId}`);
    });

    // Handle location-based notifications
    socket.on('update_location', async (data: { lat: number; lng: number; address?: string }) => {
      try {
        // Update user location in database
        await UserService.updateUserLocation(socket.userId!, data);
        
        // Join location-based rooms for nearby transactions
        const locationRoom = `location:${Math.floor(data.lat * 100)}:${Math.floor(data.lng * 100)}`;
        socket.join(locationRoom);
        
        socket.emit('location_updated', { success: true });
      } catch (error) {
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Handle real-time chat with AI
    socket.on('ai_chat_message', async (data: { message: string; context?: any }) => {
      try {
        // Forward to AI service
        const response = await fetch(`${process.env.AI_SERVICE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${socket.handshake.auth.token}`,
          },
          body: JSON.stringify({
            message: data.message,
            userId: socket.userId,
            context: data.context,
          }),
        });

        const aiResponse = await response.json();
        socket.emit('ai_chat_response', aiResponse);
      } catch (error) {
        socket.emit('ai_chat_error', { message: 'Failed to get AI response' });
      }
    });

    // Handle payment requests
    socket.on('payment_request', async (data: { 
      toUserId: string; 
      amount: number; 
      currency: string; 
      description?: string; 
    }) => {
      try {
        // Emit to recipient
        io.to(`user:${data.toUserId}`).emit('payment_request_received', {
          fromUserId: socket.userId,
          fromUser: socket.user,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          timestamp: new Date().toISOString(),
        });

        socket.emit('payment_request_sent', { success: true });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send payment request' });
      }
    });

    // Handle payment response
    socket.on('payment_response', async (data: { 
      requestId: string; 
      accepted: boolean; 
      transactionId?: string; 
    }) => {
      try {
        // Emit response back to requester
        io.to(`user:${data.requestId}`).emit('payment_response_received', {
          accepted: data.accepted,
          transactionId: data.transactionId,
          timestamp: new Date().toISOString(),
        });

        socket.emit('payment_response_sent', { success: true });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send payment response' });
      }
    });

    // Handle QR code generation requests
    socket.on('generate_qr', async (data: { 
      amount: number; 
      currency: string; 
      description?: string; 
    }) => {
      try {
        const qrData = {
          userId: socket.userId,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          timestamp: new Date().toISOString(),
        };

        socket.emit('qr_generated', {
          qrData: JSON.stringify(qrData),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to generate QR code' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User ${socket.userId} disconnected: ${reason}`);
      
      // Leave all rooms
      socket.leaveAll();
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for user ${socket.userId}:`, error);
    });
  });

  // Export io instance for use in other parts of the application
  (global as any).io = io;

  return server;
};

// Utility functions for emitting events from other parts of the application
export const emitToUser = (userId: string, event: string, data: any) => {
  const io = (global as any).io;
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitToWallet = (userId: string, event: string, data: any) => {
  const io = (global as any).io;
  if (io) {
    io.to(`wallet:${userId}`).emit(event, data);
  }
};

export const emitToLocation = (lat: number, lng: number, event: string, data: any) => {
  const io = (global as any).io;
  if (io) {
    const locationRoom = `location:${Math.floor(lat * 100)}:${Math.floor(lng * 100)}`;
    io.to(locationRoom).emit(event, data);
  }
};