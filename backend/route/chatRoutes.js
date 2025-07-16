// routes/chatRoutes.js
const express = require('express');
const router  = express.Router();
const Chats    = require('../models/Chats');
const Messages = require('../models/Messages');

// GET all chats (1:1 + groups) for a user
router.get('/:userId', async (req, res) => {
  try {
    const chats = await Chats.find({ users: req.params.userId })
      .populate('users', 'name email')
      .sort({ 'lastMessage.timestamp': -1 });
    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// POST create a new chat (1:1 or group)
router.post('/', async (req, res) => {
  // body: { users: [id1,id2,...], isGroup: Boolean, name?: String }
  try {
    const chat = await Chats.create(req.body);
    res.status(201).json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

module.exports = router;
