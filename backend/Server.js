const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

// Route imports
const authRoutes = require('./route/auth');
const projectRoutes = require('./route/project');
const manpowerRequestRoutes = require('./route/manpowerRequest');
const Message = require('./models/Messages');
const materialRequestRoutes = require('./route/materialRequest');
const { verifyToken } = require('./middleware/authMiddleware');
const userRoutes = require('./route/user');
const locationRoutes = require('./route/location');
const manpowerRoutes = require('./route/manpower');
const auditLogRoutes = require('./route/auditLog');
const dailyReportRoutes = require('./route/dailyReport');

const app = express();

// ---- CORS: allow both local and deployed frontend ----
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_ORIGIN || 'https://fadztrack.vercel.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- MongoDB connection ----
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ---- Routes ----
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/manpower-requests', manpowerRequestRoutes);
app.use('/api/requests', materialRequestRoutes);
app.use('/api/manpower', manpowerRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/uploads', express.static('uploads'));
app.get('/', (req, res) => res.send('API is working'));

// ---- HTTP + WebSocket server ----
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ---- Socket.IO ----
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('sendMessage', async (data) => {
    try {
      const newMsg = new Message({
        sender: data.sender,
        text: data.content,
        chat: data.chatId
      });

      const savedMsg = await newMsg.save();
      io.emit('receiveMessage', savedMsg);
    } catch (err) {
      console.error('❌ Save error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('🚪 Client disconnected:', socket.id);
  });
});

// ---- Port for deployment compatibility ----
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
