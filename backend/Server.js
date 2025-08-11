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

// Routes
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

/* ------------------------------- CORS ----------------------------------- */
const allowedOrigins = [
  'https://fadztrack.vercel.app',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin))
    ? cb(null, true)
    : cb(new Error('Not allowed by CORS')),
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ------------------------------ MongoDB --------------------------------- */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

/* ------------------------------ Socket.IO ------------------------------- */
const io = socketio(server, {
  cors: { origin: allowedOrigins, credentials: true },
  pingInterval: 25000,
  pingTimeout: 60000,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  path: '/socket.io',
});
app.set('io', io);

// simple helpers (optional)
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

  // per-user room (for future mentions/DMs/notifications)
  const userId = socket.handshake?.auth?.userId;
  if (userId) socket.join(`user:${userId}`);

  // join a chat conversation room
  socket.on('joinChat', (chatId) => {
    if (!chatId) return;
    socket.join(chatId);
    // console.log('↪️ joined room', chatId, 'socket', socket.id);
  });

  /**
   * ❗ IMPORTANT:
   * DO NOT broadcast "sendMessage" here. The REST route /api/messages
   * saves the message and emits 'receiveMessage' + 'chatUpdated'.
   * Having a socket 'sendMessage' here would duplicate messages.
   */
  // socket.on('sendMessage', ...)  <-- REMOVED on purpose

  // seen over socket (idempotent)
  socket.on('messageSeen', async ({ messageId, userId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const already = msg.seen?.some(s => String(s.userId) === String(userId));
      if (!already) {
        const seenEntry = { userId, timestamp: Date.now() };
        msg.seen.push(seenEntry);
        await msg.save();

        io.to(String(msg.conversation)).emit('messageSeen', {
          messageId,
          userId: seenEntry.userId,
          timestamp: seenEntry.timestamp
        });

        // optional: keep sidebars fresh
        io.emit('chatUpdated', {
          chatId: String(msg.conversation),
          lastMessage: { content: msg.content || msg.fileUrl || '', timestamp: msg.createdAt }
        });
      }
    } catch (err) {
      console.error('❌ socket messageSeen error:', err);
    }
  });

  // optional project rooms
  socket.on('joinProject', (roomName) => safeJoin(socket, roomName));
  socket.on('leaveProject', (roomName) => safeLeave(socket, roomName));

  socket.on('disconnect', (reason) => {
    // console.log('❌ Socket disconnected:', socket.id, reason);
  });
});

/* -------------------------------- Routes -------------------------------- */
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
