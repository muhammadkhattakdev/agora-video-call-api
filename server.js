const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const callRoutes = require('./routes/call.routes');
const { errorHandler } = require('./utils/response');
const { authenticateSocket } = require('./middleware/auth.middleware');

const app = express();
const server = createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/videocall-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => console.error('MongoDB connection error:', err));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Video Call API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Socket.io connection handling
const connectedUsers = new Map();
const activeRooms = new Map();

io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  
  // Store user connection
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    status: 'online',
    joinedAt: new Date()
  });

  // Broadcast user online status
  socket.broadcast.emit('user-online', {
    userId: socket.userId,
    status: 'online'
  });

  // Join user to their personal room for notifications
  socket.join(`user-${socket.userId}`);

  // Handle joining a call room
  socket.on('join-room', (data) => {
    const { roomId, userData } = data;
    
    socket.join(roomId);
    
    // Update room participants
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId).add(socket.userId);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      userId: socket.userId,
      userData,
      roomId
    });
    
    // Send current participants to the new user
    const participants = Array.from(activeRooms.get(roomId))
      .filter(id => id !== socket.userId)
      .map(id => ({
        userId: id,
        connectionInfo: connectedUsers.get(id)
      }));
    
    socket.emit('room-participants', {
      roomId,
      participants
    });
    
    console.log(`User ${socket.userId} joined room ${roomId}`);
  });

  // Handle leaving a call room
  socket.on('leave-room', (data) => {
    const { roomId } = data;
    
    socket.leave(roomId);
    
    // Update room participants
    if (activeRooms.has(roomId)) {
      activeRooms.get(roomId).delete(socket.userId);
      
      // Remove room if empty
      if (activeRooms.get(roomId).size === 0) {
        activeRooms.delete(roomId);
      }
    }
    
    // Notify others in the room
    socket.to(roomId).emit('user-left', {
      userId: socket.userId,
      roomId
    });
    
    console.log(`User ${socket.userId} left room ${roomId}`);
  });

  // Handle call invitation
  socket.on('send-call-invitation', (data) => {
    const { targetUserId, callData } = data;
    
    // Send invitation to target user
    io.to(`user-${targetUserId}`).emit('call-invitation', {
      from: socket.userId,
      callData,
      timestamp: new Date()
    });
    
    console.log(`Call invitation sent from ${socket.userId} to ${targetUserId}`);
  });

  // Handle call response
  socket.on('call-response', (data) => {
    const { targetUserId, response, callData } = data;
    
    // Send response to caller
    io.to(`user-${targetUserId}`).emit('call-response', {
      from: socket.userId,
      response,
      callData,
      timestamp: new Date()
    });
    
    console.log(`Call response ${response} sent from ${socket.userId} to ${targetUserId}`);
  });

  // Handle real-time signaling for WebRTC
  socket.on('webrtc-signal', (data) => {
    const { targetUserId, signal, type } = data;
    
    io.to(`user-${targetUserId}`).emit('webrtc-signal', {
      from: socket.userId,
      signal,
      type,
      timestamp: new Date()
    });
  });

  // Handle mute/unmute notifications
  socket.on('toggle-audio', (data) => {
    const { roomId, isAudioEnabled } = data;
    
    socket.to(roomId).emit('user-audio-toggled', {
      userId: socket.userId,
      isAudioEnabled
    });
  });

  // Handle camera on/off notifications
  socket.on('toggle-video', (data) => {
    const { roomId, isVideoEnabled } = data;
    
    socket.to(roomId).emit('user-video-toggled', {
      userId: socket.userId,
      isVideoEnabled
    });
  });

  // Handle screen sharing
  socket.on('toggle-screen-share', (data) => {
    const { roomId, isScreenSharing } = data;
    
    socket.to(roomId).emit('user-screen-share-toggled', {
      userId: socket.userId,
      isScreenSharing
    });
  });

  // Handle chat messages in room
  socket.on('send-message', (data) => {
    const { roomId, message } = data;
    
    socket.to(roomId).emit('new-message', {
      userId: socket.userId,
      message,
      timestamp: new Date()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    
    // Remove user from all rooms
    activeRooms.forEach((participants, roomId) => {
      if (participants.has(socket.userId)) {
        participants.delete(socket.userId);
        
        // Notify room participants
        socket.to(roomId).emit('user-left', {
          userId: socket.userId,
          roomId
        });
        
        // Remove room if empty
        if (participants.size === 0) {
          activeRooms.delete(roomId);
        }
      }
    });
    
    // Remove from connected users
    connectedUsers.delete(socket.userId);
    
    // Broadcast user offline status
    socket.broadcast.emit('user-offline', {
      userId: socket.userId,
      status: 'offline'
    });
  });
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Video Call API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

module.exports = { app, server, io };