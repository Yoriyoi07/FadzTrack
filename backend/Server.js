// server.js
const express      = require('express');
const cors         = require('cors');
const mongoose     = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http         = require('http');
const socketio     = require('socket.io');
const { Types }    = require('mongoose');

// Models
const Message = require('./models/Messages');
const Chat    = require('./models/Chats');

// Route imports
const authRoutes            = require('./route/auth');
const projectRoutes         = require('./route/project');
const manpowerRequestRoutes = require('./route/manpowerRequest');
const materialRequestRoutes = require('./route/materialRequest');
const userRoutes            = require('./route/user');
const locationRoutes        = require('./route/location');
const manpowerRoutes        = require('./route/manpower');
const auditLogRoutes        = require('./route/auditLog');
const chatRoutes            = require('./route/chatRoutes');
const dailyReportRoutes     = require('./route/dailyReport');
const notificationRoutes    = require('./route/notification');
const geminiRoutes          = require('./route/gemini');
const messageRoutes         = require('./route/messageRoutes');
const dssReportRoutes       = require('./route/dssReport');
const photoSignedUrlRoute   = require('./route/photoSignedUrl');

const app    = express();
const server = http.createServer(app);

// CORS setup
const allowedOrigins = [
  'https://fadztrack.vercel.app',
  'http://localhost:3000'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Socket.IO setup
const io = socketio(server, {
  cors: {
    origin:      allowedOrigins,
    credentials: true
  }
});
// Make io accessible in routes
app.set('io', io);

// === Single connection handler (no duplicates!) ===
io.on('connection', socket => {
  console.log('🔌 Socket connected:', socket.id);

  // ---- Chat rooms ----
  socket.on('joinChat', chatId => {
    socket.join(chatId);
    console.log(`↪️  Socket ${socket.id} joined chat ${chatId}`);
  });

  socket.on('sendMessage', ({ chatId, senderId, content, type }) => {
    const timestamp = Date.now();
    io.to(chatId).emit('receiveMessage', {
      _id:        new Types.ObjectId().toString(),
      conversation: chatId,
      sender:     senderId,
      content,
      type,
      fileUrl:    type === 'text' ? null : content,
      timestamp
    });
    io.emit('chatUpdated', {
      chatId,
      lastMessage: { content, timestamp }
    });
  });

  socket.on('messageSeen', async ({ messageId, userId }) => {
    try {
      const msg = await Message.findByIdAndUpdate(
        messageId,
        { $push: { seen: { userId, timestamp: Date.now() } } },
        { new: true }
      );
      io.to(msg.conversation.toString()).emit('messageSeen', {
        messageId,
        userId,
        timestamp: msg.seen[msg.seen.length - 1].timestamp
      });
      io.emit('chatUpdated', {
        chatId: msg.conversation.toString(),
        lastMessage: {
          content:   msg.content,
          timestamp: msg.createdAt
        }
      });
    } catch (err) {
      console.error('❌ socket messageSeen error:', err);
    }
  });

  // ---- Project discussion rooms ----
  // Client should emit: socket.emit('joinProject', projectId)  (NOT a prefixed string)
  socket.on('joinProject', (projectId) => {
    const room = `project:${projectId}`;
    socket.join(room);
    console.log(`↪️  Socket ${socket.id} joined ${room}`);
  });

  socket.on('leaveProject', (projectId) => {
    const room = `project:${projectId}`;
    socket.leave(room);
    console.log(`↩️  Socket ${socket.id} left ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// Mount API routes
app.get('/', (req, res) => res.send('API is working'));

app.use('/api/auth',               authRoutes);
app.use('/api/users',              userRoutes);
app.use('/api/projects',           projectRoutes);
app.use('/api/manpower-requests',  manpowerRequestRoutes);
app.use('/api/requests',           materialRequestRoutes);
app.use('/api/manpower',           manpowerRoutes);
app.use('/api/locations',          locationRoutes);
app.use('/api/audit-logs',         auditLogRoutes);
app.use('/api/notifications',      notificationRoutes);
app.use('/api/daily-reports',      dailyReportRoutes);
app.use('/api/dss-report',         dssReportRoutes);
app.use('/api/photo-signed-url',   photoSignedUrlRoute);
app.use('/api/gemini',             geminiRoutes);

// Chats & Messages
app.use('/api/chats',    chatRoutes);
app.use('/api/messages', messageRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
