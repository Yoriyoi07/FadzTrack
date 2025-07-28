// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const Chat = require('../models/Chats');
const Message = require('../models/Messages');

router.use(verifyToken);

// GET /api/chats
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await Chat.find({ users: userId })
      .sort({ 'lastMessage.timestamp': -1 })
      .populate('users', 'firstname lastname email name');
    return res.json(chats);
  } catch (err) {
    console.error('❌ GET /api/chats error:', err);
    return res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// GET /api/chats/:chatId
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate('users', 'firstname lastname email name');
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.users.some(u => u._id.toString() === req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(chat);
  } catch (err) {
    console.error('❌ GET /api/chats/:chatId error:', err);
    return res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// POST /api/chats
router.post('/', async (req, res) => {
  try {
    const me = req.user.id;
    const { users = [], isGroup = false, name } = req.body;

    // 1:1 chat
    if (!isGroup && users.length === 1) {
      const other = users[0];
      const existing = await Chat.findOne({
        isGroup: false,
        users: { $all: [me, other], $size: 2 }
      }).populate('users', 'firstname lastname email name');
      if (existing) return res.status(200).json(existing);
    }

    // Create new chat
    const members = [me, ...users];
    const chat = new Chat({
      isGroup,
      name: isGroup ? name : null,
      users: members,
      creator: isGroup ? me : null
    });
    await chat.save();

    const fullChat = await Chat.findById(chat._id)
      .populate('users', 'firstname lastname email name');
    return res.status(201).json(fullChat);
  } catch (err) {
    console.error('❌ POST /api/chats error:', err);
    return res.status(500).json({ error: 'Failed to create chat' });
  }
});

// POST /api/chats/join/:code
router.post('/join/:code', async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.params;

    const chat = await Chat.findOne({ joinCode: code, isGroup: true });
    if (!chat) return res.status(404).json({ error: 'Invalid group code' });
    if (chat.users.includes(userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

    chat.users.push(userId);
    await chat.save();

    const updated = await Chat.findById(chat._id)
      .populate('users', 'firstname lastname email name');
    return res.json(updated);
  } catch (err) {
    console.error('❌ POST /api/chats/join/:code error:', err);
    return res.status(500).json({ error: 'Failed to join group' });
  }
});

// POST /api/chats/:chatId/leave
router.post('/:chatId/leave', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.isGroup) {
      return res.status(400).json({ error: 'Cannot leave a 1:1 chat' });
    }
    if (chat.creator?.toString() === userId) {
      return res.status(400).json({ error: 'Creator cannot leave group' });
    }

    chat.users = chat.users.filter(u => u.toString() !== userId);
    await chat.save();
    return res.json({ message: 'Left the group' });
  } catch (err) {
    console.error('❌ POST /api/chats/:chatId/leave error:', err);
    return res.status(500).json({ error: 'Failed to leave group' });
  }
});

// POST /api/chats/:chatId/remove-member
router.post('/:chatId/remove-member', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.creator?.toString() !== userId) {
      return res.status(403).json({ error: 'Only creator can remove members' });
    }

    chat.users = chat.users.filter(u => u.toString() !== memberId);
    await chat.save();
    return res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('❌ POST /api/chats/:chatId/remove-member error:', err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PUT /api/chats/:chatId
router.put('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.isGroup || !chat.users.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    chat.name = name;
    await chat.save();

    const updated = await Chat.findById(chatId)
      .populate('users', 'firstname lastname email name');
    return res.json(updated);
  } catch (err) {
    console.error('❌ PUT /api/chats/:chatId error:', err);
    return res.status(500).json({ error: 'Failed to rename group' });
  }
});

// DELETE /api/chats/:chatId
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.isGroup) {
      return res.status(400).json({ error: 'Cannot delete group; use leave instead' });
    }
    if (!chat.users.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await chat.remove();
    return res.json({ message: 'Chat deleted' });
  } catch (err) {
    console.error('❌ DELETE /api/chats/:chatId error:', err);
    return res.status(500).json({ error: 'Failed to delete chat' });
  }
});

module.exports = router;
