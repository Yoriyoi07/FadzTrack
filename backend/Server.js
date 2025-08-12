// server.js
const express      = require('express');
const cors         = require('cors');
const mongoose     = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http         = require('http');
const socketio     = require('socket.io');

// Routes
const geminiRoutes           = require('./route/gemini');
const authRoutes             = require('./route/auth');
const userRoutes             = require('./route/user');
const projectRoutes          = require('./route/project');
const manpowerRequestRoutes  = require('./route/manpowerRequest');
const materialRequestRoutes  = require('./route/materialRequest');
const locationRoutes         = require('./route/location');
const manpowerRoutes         = require('./route/manpower');
const auditLogRoutes         = require('./route/auditLog');
const chatRoutes             = require('./route/chatRoutes');
const dailyReportRoutes      = require('./route/dailyReport');
const notificationRoutes     = require('./route/notification');
const messageRoutes          = require('./route/messageRoutes');
const dssReportRoutes        = require('./route/dssReport');
const photoSignedUrlRoute    = require('./route/photoSignedUrl');

// Models needed in socket handlers
const Message = require('./models/Messages');
const Chat    = require('./models/Chats');

const app    = express();
const server = http.createServer(app);

/* ------------------------------- CORS ----------------------------------- */
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://fadztrack.vercel.app',
];

const corsOptions = {
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin))
    ? cb(null, true)
    : cb(new Error('Not allowed by CORS')),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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

// NEW: user socket registry (supports multiple tabs/devices per user)
const userSockets = new Map(); // Map<userIdString, Set<socketId>>
app.set('userSockets', userSockets);

// OPTIONAL: small helpers
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

// IMPORTANT: Messages are created via REST; sockets just join rooms and receive events.
io.on('connection', (socket) => {
  // Expect client to pass auth at connect: io({ auth: { userId } })
  const rawUserId = socket.handshake?.auth?.userId || socket.handshake?.query?.userId;
  const userId = rawUserId ? String(rawUserId) : null;

  if (userId) {
    // register socket
    addUserSocket(userId, socket.id);

    // join a personal room for convenience (emit by uid)
    socket.join(`user:${userId}`);
  }

  // Join a chat room to receive message events for that conversation
  socket.on('joinChat', (chatId) => {
    if (chatId) socket.join(String(chatId));
  });

  /* ✅ NEW: join/leave per-project rooms for Discussions */
  socket.on('joinProject', (projectIdOrRoom) => {
    const room = String(projectIdOrRoom).startsWith('project:')
      ? String(projectIdOrRoom)
      : `project:${projectIdOrRoom}`;
    console.log('[socket] joinProject', socket.id, '->', room);
    socket.join(room);
  });

  socket.on('leaveProject', (projectIdOrRoom) => {
    const room = String(projectIdOrRoom).startsWith('project:')
      ? String(projectIdOrRoom)
      : `project:${projectIdOrRoom}`;
    console.log('[socket] leaveProject', socket.id, '->', room);
    socket.leave(room);
  });
  /* ✅ END NEW */

  // Idempotent "seen" over socket
  socket.on('messageSeen', async ({ messageId, userId: seenBy }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const already = (msg.seen || []).some(s => String(s.userId) === String(seenBy));
      if (!already) {
        const ts = Date.now();
        msg.seen = msg.seen || [];
        msg.seen.push({ userId: seenBy, timestamp: ts });
        await msg.save();

        io.to(String(msg.conversation)).emit('messageSeen', {
          messageId: String(msg._id),
          userId:    String(seenBy),
          timestamp: ts
        });

        io.emit('chatUpdated', {
          chatId: String(msg.conversation),
          lastMessage: { content: msg.content || msg.fileUrl || '', timestamp: msg.createdAt }
        });
      }
    } catch (err) {
      console.error('socket messageSeen error:', err);
    }
  });

  socket.on('disconnect', () => {
    if (userId) removeUserSocket(userId, socket.id);
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
