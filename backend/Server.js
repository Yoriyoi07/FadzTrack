const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const http = require('http');
const socketio = require('socket.io');

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

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'https://fadztrack.vercel.app',
  'http://localhost:3000'
];

// ---- CORS ----
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); 
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
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
app.use('/api/notifications', notificationRoutes);
app.use('/uploads', express.static('uploads'));
app.get('/', (req, res) => res.send('API is working'));

// ---- SOCKET.IO Live Notification Logic ----
const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});
const userSockets = {}; 

io.on('connection', (socket) => {
   console.log("🔌 New Socket.IO client connected:", socket.id);
  socket.on('register', (userId) => {
     console.log(`✅ Registered user ${userId} with socket ${socket.id}`);
    userSockets[userId] = socket.id;
  });

  socket.on('disconnect', () => {
    for (const [userId, sockId] of Object.entries(userSockets)) {
      if (sockId === socket.id) {
        delete userSockets[userId];
        console.log(`❌ User ${userId} disconnected and removed from sockets`);
      }
    }
  });
});

// Make available in requests (controllers)
app.set('io', io);
app.set('userSockets', userSockets);

// ---- Port for deployment compatibility ----
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
