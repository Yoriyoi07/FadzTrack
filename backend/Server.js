// server.js
const express      = require('express');
const cors         = require('cors');
const mongoose     = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http         = require('http');
const geminiRoutes = require('./route/gemini');
const socketio     = require('socket.io');

// Models (singular file names as per your latest)
const Message = require('./models/Messages');
const Chat    = require('./models/Chats');

// Routes (keep your existing route implementations)
const authRoutes            = require('./route/auth');
const userRoutes            = require('./route/user');
const projectRoutes         = require('./route/project');
const manpowerRequestRoutes = require('./route/manpowerRequest');
const materialRequestRoutes = require('./route/materialRequest');
const locationRoutes        = require('./route/location');
const manpowerRoutes        = require('./route/manpower');
const auditLogRoutes        = require('./route/auditLog');
const chatRoutes            = require('./route/chatRoutes');
const dailyReportRoutes     = require('./route/dailyReport');
const notificationRoutes    = require('./route/notification');
const messageRoutes         = require('./route/messageRoutes');
const dssReportRoutes       = require('./route/dssReport');
const photoSignedUrlRoute   = require('./route/photoSignedUrl');

const app    = express();
const server = http.createServer(app);

/* ------------------------------- CORS ----------------------------------- */
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://fadztrack.vercel.app', // keep if you deploy here
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
app.options('*', cors(corsOptions)); // Preflight

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

// IMPORTANT: Do NOT listen for a "sendMessage" socket event here.
// Messages are created via REST /api/messages, which then emits to rooms.
io.on('connection', (socket) => {
  const userId = socket.handshake?.auth?.userId;
  if (userId) socket.join(`user:${userId}`);

  socket.on('joinChat', (chatId) => {
    if (chatId) socket.join(String(chatId));
  });

  // Idempotent "seen" over socket
  socket.on('messageSeen', async ({ messageId, userId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const already = (msg.seen || []).some(s => String(s.userId) === String(userId));
      if (!already) {
        const ts = Date.now();
        msg.seen = msg.seen || [];
        msg.seen.push({ userId, timestamp: ts });
        await msg.save();

        io.to(String(msg.conversation)).emit('messageSeen', {
          messageId: String(msg._id),
          userId:    String(userId),
          timestamp: ts
        });

        // keep sidebars fresh
        io.emit('chatUpdated', {
          chatId: String(msg.conversation),
          lastMessage: { content: msg.content || msg.fileUrl || '', timestamp: msg.createdAt }
        });
      }
    } catch (err) {
      console.error('socket messageSeen error:', err);
    }
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
