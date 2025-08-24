const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http = require('http');
const socketio = require('socket.io');

// Routes
const geminiRoutes = require('./route/gemini');
const authRoutes = require('./route/auth');
const userRoutes = require('./route/user');
const projectRoutes = require('./route/project');
const manpowerRequestRoutes = require('./route/manpowerRequest');
const materialRequestRoutes = require('./route/materialRequest');
const locationRoutes = require('./route/location');
const manpowerRoutes = require('./route/manpower');
const auditLogRoutes = require('./route/auditLog');
const chatRoutes = require('./route/chatRoutes');
const dailyReportRoutes = require('./route/dailyReport');
const notificationRoutes = require('./route/notification');
const messageRoutes = require('./route/messageRoutes');
const dssReportRoutes = require('./route/dssReport');
const photoSignedUrlRoute = require('./route/photoSignedUrl');

// Models
const Message = require('./models/Messages');
const Chat = require('./models/Chats');

const app = express();
const server = http.createServer(app);

// Trust Proxy
app.set('trust proxy', 1);

// CORS setup
const defaultFE = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = [
  defaultFE,
  'http://localhost:3000',
  'https://fadztrack.vercel.app',
];

function norm(url = '') {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

const allowedSet = new Set(allowedOrigins.map(norm));

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const o = norm(origin);
    if (allowedSet.has(o)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Socket.IO setup
const io = socketio(server, {
  cors: {
    origin: Array.from(allowedSet),
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
  },
  path: '/socket.io',
});

app.set('io', io);

const userSockets = new Map(); // Map<userIdString, Set<socketId>>
app.set('userSockets', userSockets);

function addUserSocket(userId, socketId) {
  const uid = String(userId);
  if (!userSockets.has(uid)) userSockets.set(uid, new Set());
  userSockets.get(uid).add(socketId);
}

function removeUserSocket(userId, socketId) {
  const uid = String(userId);
  const set = userSockets.get(uid);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(uid);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  const rawUserId =
    socket.handshake?.auth?.userId || socket.handshake?.query?.userId;
  const userId = rawUserId ? String(rawUserId) : null;
// inside io.on('connection', (socket) => { ... })
socket.on('joinChat', (chatId) => {
  const room = String(chatId);
  socket.join(room);
});

socket.on('leaveChat', (chatId) => {
  const room = String(chatId);
  socket.leave(room);
});

  if (userId) {
    addUserSocket(userId, socket.id);
    socket.join(`user:${userId}`);
    console.log(`User ${userId} connected with socket ID: ${socket.id}`);
    socket.emit('notification', {
      message: 'Test notification',
      type: 'general',
    });
  } else {
    console.log('No user ID found in socket handshake');
  }

  socket.on('register', (userId) => {
    try {
      const uid = userId && userId.userId ? String(userId.userId) : String(userId);
      console.log(`Register event: adding user ${uid} for socket ${socket.id}`);
      addUserSocket(uid, socket.id);
      socket.join(`user:${uid}`);
    } catch (err) {
      console.error('Error in register handler:', err);
    }
  });

  socket.on('joinProject', (projectIdOrRoom) => {
    const room = `project:${String(projectIdOrRoom)}`;
    console.log('[socket] joinProject', socket.id, '->', room);
    socket.join(room);
  });

  socket.on('leaveProject', (projectIdOrRoom) => {
    const room = `project:${String(projectIdOrRoom)}`;
    console.log('[socket] leaveProject', socket.id, '->', room);
    socket.leave(room);
  });

  socket.on('messageSeen', async ({ messageId, userId: seenBy }) => {
    try {
      const msg = await Message.findById(messageId).lean();
      if (!msg) return;

      const already = (msg.seen || []).some(s => String(s.userId) === String(seenBy));
      if (already) return;

      const ts = Date.now();

      // Update without triggering validation on the whole doc
      await Message.updateOne(
        { _id: messageId },
        { $push: { seen: { userId: seenBy, timestamp: ts } } },
        { runValidators: false }
      );

      io.to(String(msg.conversation)).emit('messageSeen', {
        messageId: String(messageId),
        userId: String(seenBy),
        timestamp: ts,
      });

      io.emit('chatUpdated', {
        chatId: String(msg.conversation),
        lastMessage: {
          content: msg.message || (msg.fileUrl || '') || '',
          timestamp: msg.createdAt,
        },
      });
    } catch (err) {
      console.error('socket messageSeen error (updateOne path):', err);
    }
  });

  socket.on('disconnect', (reason) => {
    try {
      if (userId) {
        removeUserSocket(userId, socket.id);
        console.log(`User ${userId} disconnected with socket ID: ${socket.id}`);
        console.log(`Socket disconnected due to: ${reason}`);
        return;
      }


      
      // If no userId from handshake, attempt to remove this socket from any user sets
      for (const [uid, set] of userSockets.entries()) {
        if (set && set.has(socket.id)) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(uid);
          console.log(`Removed socket ${socket.id} from user ${uid} on disconnect`);
          break;
        }
      }
      console.log('Socket disconnected without user ID');
    } catch (err) {
      console.error('Error during disconnect cleanup:', err);
    }
  });
});

// Routes setup
app.get('/', (req, res) => res.send('API is working'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/manpower-requests', manpowerRequestRoutes);
app.use('/api/requests', materialRequestRoutes);
app.use('/api/manpower', manpowerRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/dss-report', dssReportRoutes);
app.use('/api/photo-signed-url', photoSignedUrlRoute);
app.use('/api/gemini', geminiRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));