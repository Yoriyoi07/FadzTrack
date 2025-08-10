const express      = require('express');
const cors         = require('cors');
const mongoose     = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http         = require('http');
const socketio     = require('socket.io');
const { Types }    = require('mongoose');

// Models (keep yours)
const Message = require('./models/Messages');
const Chat    = require('./models/Chats');

// Routes (keep yours)
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

// CORS
const allowedOrigins = [
  'https://fadztrack.vercel.app',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error('Not allowed by CORS')),
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mongo
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Socket.IO — tune pings & enable recovery
const io = socketio(server, {
  cors: { origin: allowedOrigins, credentials: true },
  pingInterval: 25000,   // client sends a ping every 25s
  pingTimeout: 60000,    // consider dead after no pong for 60s
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 }, // 2 minutes
  path: '/socket.io',    // default path; keep in sync with client
});
app.set('io', io);

// helpful util to avoid duplicate room joins per socket
function safeJoin(socket, room) {
  if (socket.data.currentRoom === room) return false;
  if (socket.data.currentRoom) socket.leave(socket.data.currentRoom);
  socket.join(room);
  socket.data.currentRoom = room;
  return true;
}
function safeLeave(socket, room) {
  if (socket.data.currentRoom !== room) return false;
  socket.leave(room);
  socket.data.currentRoom = null;
  return true;
}

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // 🔐 Join per-user room for mention notifications
  const userId = socket.handshake?.auth?.userId;
  if (userId) {
    socket.join(`user:${userId}`);
  }

  // ---- Chat rooms (unchanged) ----
  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('sendMessage', ({ chatId, senderId, content, type }) => {
    const timestamp = Date.now();
    io.to(chatId).emit('receiveMessage', {
      _id: new Types.ObjectId().toString(),
      conversation: chatId,
      sender: senderId,
      content,
      type,
      fileUrl: type === 'text' ? null : content,
      timestamp
    });
    io.emit('chatUpdated', { chatId, lastMessage: { content, timestamp } });
  });

  socket.on('messageSeen', async ({ messageId, userId }) => {
    try {
      const msg = await Message.findByIdAndUpdate(
        messageId,
        { $push: { seen: { userId, timestamp: Date.now() } } },
        { new: true }
      );
      io.to(msg.conversation.toString()).emit('messageSeen', {
        messageId, userId, timestamp: msg.seen[msg.seen.length - 1].timestamp
      });
      io.emit('chatUpdated', {
        chatId: msg.conversation.toString(),
        lastMessage: { content: msg.content, timestamp: msg.createdAt }
      });
    } catch (err) {
      console.error('❌ socket messageSeen error:', err);
    }
  });

  // ---- Project discussion rooms (idempotent) ----
  socket.on('joinProject', (roomName) => {
    if (safeJoin(socket, roomName)) {
      console.log(`↪️  ${socket.id} joined ${roomName}`);
    }
  });

  socket.on('leaveProject', (roomName) => {
    if (safeLeave(socket, roomName)) {
      console.log(`↩️  ${socket.id} left ${roomName}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', socket.id, reason);
  });
});

// Routes
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
app.use('/api/chats',              chatRoutes);
app.use('/api/messages',           messageRoutes);

app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
