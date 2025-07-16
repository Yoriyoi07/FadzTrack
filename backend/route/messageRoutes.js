// routes/messageRoutes.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();

const Message = require('../models/Messages');
const Chat    = require('../models/Chats'); 

// — Multer setup for file/image uploads —
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2,9)}${ext}`);
  }
});
const upload = multer({ storage });

// ── 1) Fetch messages in a chat ────────────────────────────────
router.get('/:chatId', async (req, res) => {
  try {
    const msgs = await Message.find({ conversation: req.params.chatId })
                             .populate('sender', 'name')
                             .sort({ timestamp: 1 });
    res.json(msgs);
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ── 2) Send a message (text or file/image) ──────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // IMPORTANT: destructure conversationId, not conversation
    const { conversationId, sender, type, content } = req.body;
    const payload = { conversation: conversationId, sender };

    if (type === 'text') {
      payload.content = content;
      payload.type    = 'text';
    } else {
      // multer stored the file; serve it from /uploads
      payload.content = `/uploads/${req.file.filename}`;
      payload.type    = type; // 'image' or 'file'
    }

    const msg = await Message.create(payload);

    // update chat.lastMessage for preview/sorting
    await Chat.findByIdAndUpdate(conversationId, {
      lastMessage: { content: payload.content, timestamp: msg.timestamp }
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error('Failed to send message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── 3) Add or replace a reaction ────────────────────────────────
router.post('/:messageId/reactions', async (req, res) => {
  try {
    const { userId, emoji } = req.body;
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    // remove any existing reaction by this user
    msg.reactions = msg.reactions.filter(r => r.userId.toString() !== userId);
    // add the new one
    msg.reactions.push({ userId, emoji });
    await msg.save();

    res.json(msg);
  } catch (err) {
    console.error('Failed to add/replace reaction:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// ── 4) Remove a reaction ────────────────────────────────────────
router.delete('/:messageId/reactions', async (req, res) => {
  try {
    const { userId, emoji } = req.body;
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    // filter out exactly that user + emoji
    msg.reactions = msg.reactions.filter(
      r => !(r.userId.toString() === userId && r.emoji === emoji)
    );
    await msg.save();

    res.json(msg);
  } catch (err) {
    console.error('Failed to remove reaction:', err);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

module.exports = router;
