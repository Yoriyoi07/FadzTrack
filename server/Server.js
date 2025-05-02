const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./route/auth');
const Message = require('./models/Messages');


const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => res.send('API is working'));

// HTTP + WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('sendMessage', async (data) => {
    try {
      const newMsg = new Message({
        sender: data.sender,
        content: data.content,
        chatId: data.chatId
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
