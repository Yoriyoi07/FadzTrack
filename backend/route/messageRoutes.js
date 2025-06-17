const express = require('express');
const router = express.Router();
const Message = require('../models/Messages');
const User = require('../models/User'); 

router.post('/', async (req, res) => {
  const { sender, receiver, content } = req.body;
  try {
    const message = new Message({ sender, receiver, content });
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/conversations/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    }).sort({ timestamp: -1 });

    const convoMap = {};
    for (const msg of messages) {
      const otherUserId = msg.sender.toString() === userId ? msg.receiver.toString() : msg.sender.toString();
      if (!convoMap[otherUserId]) convoMap[otherUserId] = msg;
    }

    const users = await User.find({ _id: { $in: Object.keys(convoMap) } });

    const result = users.map(u => ({
      user: {
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone
      },
      lastMessage: convoMap[u._id]
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});


router.get('/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort('timestamp');
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});


module.exports = router;
