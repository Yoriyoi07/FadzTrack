// server.js
const express      = require('express');
const cors         = require('cors');
const mongoose     = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http         = require('http');
const socketio     = require('socket.io');

// Models
const Message = require('./models/Messages');
const Chat    = require('./models/Chats');

<<<<<<< Updated upstream
// --- Route imports
const authRoutes = require('./route/auth');
const projectRoutes = require('./route/project');
const manpowerRequestRoutes = require('./route/manpowerRequest');
const materialRequestRoutes = require('./route/materialRequest');
const { verifyToken } = require('./middleware/authMiddleware');
const userRoutes = require('./route/user');
const locationRoutes = require('./route/location');
const manpowerRoutes = require('./route/manpower');
const auditLogRoutes = require('./route/auditLog');
const dailyReportRoutes = require('./route/dailyReport');
const notificationRoutes = require('./route/notification');
const geminiRoutes = require('./route/gemini');
const messageRoutes = require('./route/messageRoutes');
const dssReportRoutes = require('./route/dssReport');
const app = express();
=======
// Route imports
const authRoutes             = require('./route/auth');
const projectRoutes          = require('./route/project');
const manpowerRequestRoutes  = require('./route/manpowerRequest');
const materialRequestRoutes  = require('./route/materialRequest');
const { verifyToken }        = require('./middleware/authMiddleware');
const userRoutes             = require('./route/user');
const locationRoutes         = require('./route/location');
const manpowerRoutes         = require('./route/manpower');
const auditLogRoutes         = require('./route/auditLog');
const chatRoutes             = require('./route/chatRoutes');
const dailyReportRoutes      = require('./route/dailyReport');
const notificationRoutes     = require('./route/notification');
const geminiRoutes           = require('./route/gemini');
const messageRoutes          = require('./route/messageRoutes');
const dssReportRoutes        = require('./route/dssReport');

const app    = express();
>>>>>>> Stashed changes
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
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

<<<<<<< Updated upstream
// ---- Routes ----

app.use('/api/gemini', geminiRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/manpower-requests', manpowerRequestRoutes);
app.use('/api/requests', materialRequestRoutes);
app.use('/api/manpower', manpowerRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dss-report', dssReportRoutes);
app.use('/api/messages', messageRoutes);
=======
// Mount API routes
app.use('/api/gemini',              geminiRoutes);
app.use('/api/daily-reports',       dailyReportRoutes);
app.use('/api/auth',                authRoutes);
app.use('/api/users',               userRoutes);
app.use('/api/projects',            projectRoutes);
app.use('/api/manpower-requests',   manpowerRequestRoutes);
app.use('/api/requests',            materialRequestRoutes);
app.use('/api/manpower',            manpowerRoutes);
app.use('/api/locations',           locationRoutes);
app.use('/api/audit-logs',          auditLogRoutes);
app.use('/api/notifications',       notificationRoutes);
app.use('/api/dss-report',          dssReportRoutes);

// **Chat & Message** API
app.use('/api/chats',    chatRoutes);
app.use('/api/messages', messageRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

>>>>>>> Stashed changes
app.get('/', (req, res) => res.send('API is working'));

// Socket.IO setup
const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

io.on('connection', socket => {
  console.log('🔌 Socket connected:', socket.id);

  // Join a chat room
  socket.on('joinChat', chatId => {
    socket.join(chatId);
    console.log(`↪️ Socket ${socket.id} joined chat ${chatId}`);
  });

  // Handle sending a message into a chat
  socket.on('sendMessage', async ({ chatId, senderId, content, type }) => {
    try {
      // 1) Save to DB
      const msg = await Message.create({
        conversation: chatId,
        sender:       senderId,
        content,
        type
      });

      // 2) Update Chat.lastMessage
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: { content, timestamp: msg.timestamp }
      });

      // 3) Broadcast to everyone in that chat room
      io.to(chatId).emit('receiveMessage', msg);
    } catch (err) {
      console.error('❌ sendMessage error:', err);
    }
  });

  socket.on('messageSeen', async ({ chatId, messageId, userId }) => {
    // 1) save to DB: add { userId, timestamp: Date.now() } to msg.seen array
    const msg = await Message.findByIdAndUpdate(
      messageId,
      { $push: { seen: { userId, timestamp: Date.now() } } },
      { new: true }
    );
    // 2) broadcast back to room
    io.to(chatId).emit('messageSeen', {
      messageId,
      userId,
      timestamp: msg.seen[msg.seen.length - 1].timestamp
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
