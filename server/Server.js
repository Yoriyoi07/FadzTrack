const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const { verifyJWT } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/fadztrack', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', verifyJWT, messageRoutes);

let onlineUsers = {};

io.on('connection', (socket) => {
  console.log('User connected', socket.id);

  socket.on('add-user', (userId) => {
    onlineUsers[userId] = socket.id;
  });

  socket.on('send-msg', (data) => {
    const sendToSocket = onlineUsers[data.to];
    if (sendToSocket) {
      io.to(sendToSocket).emit('msg-receive', data.message);
    }
  });

  socket.on('disconnect', () => {
    Object.keys(onlineUsers).forEach(key => {
      if (onlineUsers[key] === socket.id) delete onlineUsers[key];
    });
  });
});

server.listen(5000, () => console.log('Server running on port 5000'));
