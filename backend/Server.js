const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http = require('http');
const socketio = require('socket.io');
const helmet = require('helmet');

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
const hrSiteAttendanceRoutes = require('./route/hrSiteAttendance');

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
  'https://www.fadztrack.online',
  'https://fadztrack.online',
];

function norm(url = '') {
  try { const u = new URL(url); return `${u.protocol}//${u.host}`; }
  catch { return (url || '').replace(/\/+$/, ''); } // trim trailing slashes if any
}

const allowedSet = new Set(allowedOrigins.map(norm));
const corsDelegate = (req, cb) => {
  const origin = req.headers.origin;
  const o = norm(origin);
  const ok = !origin || allowedSet.has(o);

  // DEBUG (remove later)
  if (req.method === 'OPTIONS') {
    console.log('[CORS preflight]', { origin, normalized: o, ok, allowed: [...allowedSet] });
  }

  cb(null, {
    origin: ok,                               // true | false
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    // omit allowedHeaders so 'cors' reflects what browser asked for
    optionsSuccessStatus: 204,
  });
};

app.use(cors(corsDelegate));
app.options('*', cors(corsDelegate));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------------------------------------------
// Security Headers (Helmet + fine‑tuned policies)
// ------------------------------------------------------------
// NOTE: Adjust directives (e.g., img-src, connect-src) as needed when adding new CDNs/features.
// Use environment FRONTEND_URL allow-list for CSP origins.

const feOrigins = Array.from(allowedSet);
// Build basic directive lists
const self = "'self'";
const none = "'none'";

// Allow websocket connections to same origins
const wsOrigins = feOrigins.map(o => o.replace(/^http/, 'ws'));

app.use(helmet({
  xssFilter: false, // deprecated header automatically removed in Helmet v7
  crossOriginResourcePolicy: { policy: 'same-site' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false, // may block Canvas/Worker use otherwise
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': [self],
      'base-uri': [self],
      'font-src': [self, 'https:', 'data:'],
      'img-src': [self, 'data:', 'blob:', 'https:'],
      'script-src': [self, 'https:', 'blob:'],
      'script-src-attr': [none],
      'style-src': [self, 'https:', "'unsafe-inline'"], // inline styles often in React build
      'connect-src': [self, ...feOrigins, ...wsOrigins, 'https://api.openai.com', 'https://*.supabase.co'],
      'frame-ancestors': [self], // mitigates clickjacking (also mirrors X-Frame-Options)
      'object-src': [none],
      'upgrade-insecure-requests': [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'sameorigin' },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// Additional explicit headers (Helmet covers most but we ensure scan passes)
app.use((req, res, next) => {
  // X-Content-Type-Options (helmet sets via noSniff but be explicit)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Permissions-Policy (formerly Feature-Policy) – tighten as needed
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'microphone=()',
    'payment=()',
    'usb=()',
    'fullscreen=(self)',
    'clipboard-read=(self)',
    'clipboard-write=(self)'
  ].join(', '));
  next();
});

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
    // Presence: send full snapshot and broadcast online event
    try {
      // Update presence field (non-blocking)
      try { require('./models/User').updateOne({ _id: userId }, { $set: { presenceStatus: 'online' } }).lean && null; } catch {}
      socket.emit('presenceSnapshot', Array.from(userSockets.keys()));
      socket.broadcast.emit('userOnline', userId);
    } catch (e) { /* ignore */ }
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

  // Presence: client can request a snapshot
  socket.on('getPresence', () => {
    try { socket.emit('presenceSnapshot', Array.from(userSockets.keys())); } catch {}
  });

  // Client marks chat read (lightweight; no DB persistence yet)
  socket.on('markChatRead', ({ chatId, timestamp }) => {
    if (!chatId || !userId) return;
    const ts = timestamp || Date.now();
    (async () => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.lastMessage) {
          socket.emit('chatReadReceipt', { chatId: String(chatId), timestamp: ts });
          return;
        }
        const already = (chat.lastMessage.seen || []).some(u => String(u) === String(userId));
        if (!already && String(chat.lastMessage.sender) !== String(userId)) {
          chat.lastMessage.seen = [...(chat.lastMessage.seen || []), userId];
          await chat.save();
          io.emit('chatUpdated', { chatId: String(chat._id), lastMessage: chat.lastMessage });
        }
        socket.emit('chatReadReceipt', { chatId: String(chatId), timestamp: ts });
      } catch (e) {
        socket.emit('chatReadReceipt', { chatId: String(chatId), timestamp: ts, error: true });
      }
    })();
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

      // Also add viewer to chat.lastMessage.seen if message corresponds to chat.lastMessage (supports legacy chats without sender field)
      try {
        const chat = await Chat.findById(msg.conversation);
        if (chat && chat.lastMessage) {
          const isSameSender = chat.lastMessage.sender && String(chat.lastMessage.sender) === String(msg.senderId);
          const tsMatch = chat.lastMessage.timestamp && msg.createdAt && new Date(chat.lastMessage.timestamp).getTime() === new Date(msg.createdAt).getTime();
          if (!chat.lastMessage.sender && tsMatch) {
            // Backfill missing sender for legacy record
            chat.lastMessage.sender = msg.senderId;
          }
          if (isSameSender || tsMatch) {
          const alreadyIn = (chat.lastMessage.seen||[]).some(u => String(u) === String(seenBy));
          if (!alreadyIn) {
            chat.lastMessage.seen = [...(chat.lastMessage.seen||[]), seenBy];
            await chat.save();
            io.emit('chatUpdated', { chatId: String(msg.conversation), lastMessage: chat.lastMessage });
          }
          }
        }
      } catch (e) { /* ignore */ }
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
        // If user fully offline (no sockets left) broadcast offline
        if (!userSockets.has(String(userId))) {
          try {
            // Update presence field (non-blocking)
            try { require('./models/User').updateOne({ _id: userId }, { $set: { presenceStatus: 'offline' } }).lean && null; } catch {}
            socket.broadcast.emit('userOffline', userId);
          } catch {}
        }
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

// ------------------------------------------------------------------
// MongoDB Change Streams: cross-service real-time sync for chat
// Requires MongoDB replica set (e.g., Atlas). If unsupported, we log and skip.
// ------------------------------------------------------------------
function setupChangeStreams(ioInstance) {
  try {
    // watch Messages for inserts and updates (reactions/edits)
    const msgStream = Message.watch([], { fullDocument: 'updateLookup' });
    msgStream.on('change', async (change) => {
      try {
        if (change.operationType === 'insert') {
          const doc = change.fullDocument || {};
          const payload = {
            _id: String(doc._id),
            conversation: String(doc.conversation),
            sender: String(doc.senderId),
            content: doc.message || (Array.isArray(doc.attachments) && doc.attachments[0]?.url) || '',
            timestamp: doc.createdAt || new Date(),
            attachments: doc.attachments || [],
            replyTo: doc.replyTo ? String(doc.replyTo) : null,
            forwardOf: doc.forwardOf ? String(doc.forwardOf) : null,
          };
          ioInstance.to(String(doc.conversation)).emit('receiveMessage', payload);

          // Fallback: ensure Chats.lastMessage is updated even if the writer (e.g., mobile) didn’t do it
          try {
            // Build a preview similar to messageRoutes
            const atts = Array.isArray(doc.attachments) ? doc.attachments : [];
            const first = atts[0] || {};
            const mime = first.mime || first.mimetype || '';
            const preview = (doc.message && String(doc.message).trim()) || (
              atts.length === 0 ? '' :
              (atts.length === 1
                ? (mime.startsWith('image/') ? '📷 Photo' :
                   mime.startsWith('video/') ? '🎥 Video' :
                   mime.startsWith('audio/') ? '🎵 Audio' :
                   `📎 ${first.name || 'Attachment'}`)
                : `📎 ${atts.length} attachments`)
            );

            const lastMessage = {
              content: preview,
              timestamp: doc.createdAt || new Date(),
              sender: doc.senderId,
              seen: [doc.senderId].filter(Boolean),
            };

            await Chat.updateOne(
              { _id: doc.conversation },
              { $set: { lastMessage } },
              { timestamps: false }
            );

            // Emit chatUpdated so sidebars refresh immediately
            ioInstance.emit('chatUpdated', { chatId: String(doc.conversation), lastMessage });
          } catch (e) {
            console.warn('[ChangeStream][Message insert] lastMessage fallback failed:', e?.message || e);
          }
        } else if (change.operationType === 'update' || change.operationType === 'replace') {
          const doc = change.fullDocument || {};
          const updatedFields = (change.updateDescription && change.updateDescription.updatedFields) || {};
          const updatedKeys = Object.keys(updatedFields);

          // If reactions changed, broadcast reactions
          if (updatedKeys.some(k => k === 'reactions' || k.startsWith('reactions.'))) {
            ioInstance.to(String(doc.conversation)).emit('messageReaction', {
              messageId: String(doc._id),
              reactions: doc.reactions || [],
            });
          }

          // If message content or deleted flag changed, broadcast as receiveMessage (update)
          if (updatedKeys.some(k => k === 'message' || k === 'deleted' || k === 'attachments' || k.startsWith('attachments.'))) {
            ioInstance.to(String(doc.conversation)).emit('receiveMessage', {
              _id: String(doc._id),
              conversation: String(doc.conversation),
              sender: String(doc.senderId),
              content: doc.message || '',
              timestamp: doc.updatedAt || new Date(),
              attachments: doc.attachments || [],
              replyTo: doc.replyTo ? String(doc.replyTo) : null,
              forwardOf: doc.forwardOf ? String(doc.forwardOf) : null,
            });
          }
        }
      } catch (e) {
        console.error('[ChangeStream][Message] handler error:', e);
      }
    });
    msgStream.on('error', (err) => console.warn('Message change stream error:', err?.message || err));

    // watch Chats for lastMessage updates
    const chatStream = Chat.watch([], { fullDocument: 'updateLookup' });
    chatStream.on('change', (change) => {
      try {
        if (change.operationType === 'update' || change.operationType === 'replace') {
          const updatedFields = (change.updateDescription && change.updateDescription.updatedFields) || {};
          const keys = Object.keys(updatedFields);
          if (keys.some(k => k === 'lastMessage' || k.startsWith('lastMessage.'))) {
            const chatDoc = change.fullDocument || {};
            io.emit('chatUpdated', { chatId: String(chatDoc._id), lastMessage: chatDoc.lastMessage });
          }
        }
      } catch (e) {
        console.error('[ChangeStream][Chat] handler error:', e);
      }
    });
    chatStream.on('error', (err) => console.warn('Chat change stream error:', err?.message || err));

    console.log('✅ MongoDB Change Streams initialized');
  } catch (err) {
    console.warn('⚠️ Change Streams not available (is MongoDB a replica set/Atlas?). Skipping. Reason:', err?.message || err);
  }
}

// Initialize change streams once Socket.IO is ready and DB is connected
function initChangeStreamsWhenReady() {
  const start = () => {
    try { setupChangeStreams(io); } catch (e) { console.warn('Change Streams setup failed:', e?.message || e); }
  };
  if (mongoose.connection.readyState === 1) start();
  else mongoose.connection.once('connected', start);
}
initChangeStreamsWhenReady();

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
app.use('/api/hr-site-attendance', hrSiteAttendanceRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));