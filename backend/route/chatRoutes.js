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
  // Build unique member list (avoid duplicate creator IDs)
  const members = Array.from(new Set([me, ...users].map(id => id.toString())));
    const chat = new Chat({
      isGroup,
      name: isGroup ? name : null,
      users: members,
      creator: isGroup ? me : null
    });
    await chat.save();

    const fullChat = await Chat.findById(chat._id)
      .populate('users', 'firstname lastname email name');
    // realtime broadcast to members
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    if (io && fullChat) {
      const members = fullChat.users.map(u => String(u._id));
      members.forEach(uid => io.to(`user:${uid}`)); // ensure rooms exist
      io.emit('chatCreated', fullChat); // fallback broad (clients filter)
    }
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
  if (chat.users.some(u => u.toString() === userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

  chat.users.push(userId);
  // Dedupe legacy duplicates here too
  chat.users = Array.from(new Set(chat.users.map(u => u.toString())));
    await chat.save();

    const updated = await Chat.findById(chat._id)
      .populate('users', 'firstname lastname email name');
    const io = req.app.get('io');
    if (io && updated) {
      io.emit('chatMembersUpdated', { chatId: updated._id, users: updated.users, name: updated.name });
    }
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
    const wasCreator = chat.creator && chat.creator.toString() === userId;
    chat.users = chat.users.filter(u => u.toString() !== userId);
    // If creator left, promote first remaining member (if any)
    if (wasCreator) {
      if (chat.users.length) {
        chat.creator = chat.users[0];
      } else {
        chat.creator = null; // no members left
      }
    }
    await chat.save();
    const io = req.app.get('io');
    if (io) {
      io.emit('chatMembersUpdated', { chatId: chat._id, users: chat.users, name: chat.name });
    }
    return res.json({ message: 'Left the group', chatId: chat._id, creatorChanged: wasCreator });
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
  const userId = String(req.user.id);

  const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    // Backward compatibility: some legacy group chats may not have a creator set.
    if (!chat.creator && chat.isGroup) {
      // Promote the first user as creator (or current requester if part of chat)
      chat.creator = chat.users?.[0] || userId;
      await chat.save();
    }
  // Re-fetch after potential migration (chat may have been saved already)
  const isCreator = chat.creator && chat.creator.toString() === userId;
  const isFirstUser = chat.users?.[0] && chat.users[0].toString() === userId;
  console.log('[remove-member] chatId=%s requester=%s creator=%s isCreator=%s isFirstUser=%s memberId=%s users=%j', chatId, userId, chat.creator, isCreator, isFirstUser, memberId, chat.users);
  if (!(isCreator || isFirstUser)) {
      return res.status(403).json({ error: 'Only creator can remove members' });
    }

  chat.users = chat.users.filter(u => u.toString() !== memberId);
  chat.users = Array.from(new Set(chat.users.map(u => u.toString())));
  await chat.save();
  const updated = await Chat.findById(chatId).populate('users','firstname lastname email name');
  const io = req.app.get('io');
  if (io && updated) {
    io.emit('chatMembersUpdated', { chatId: updated._id, users: updated.users, name: updated.name });
  }
  return res.json({ message: 'Member removed', chat: updated });
  } catch (err) {
    console.error('❌ POST /api/chats/:chatId/remove-member error:', err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PUT /api/chats/:chatId
router.put('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name, users } = req.body;
  const userId = String(req.user.id);

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    console.log('[put-chat:init] chatId=%s requester=%s isGroup=%s users=%j creator=%s', chatId, userId, chat.isGroup, chat.users, chat.creator);
    if (!chat.isGroup || !chat.users.some(u => u.toString() === userId)) {
      return res.status(403).json({ error: 'Access denied (not member or not group)', reason: 'not-member-or-not-group' });
    }

    // Migrate creator if missing (legacy groups) before processing changes
    if (!chat.creator && chat.isGroup) {
      chat.creator = chat.users?.[0] || userId;
    }

    // Rename (any member can rename? restrict to creator if desired)
    if (typeof name === 'string' && name.trim()) {
      if (chat.creator && chat.creator.toString() !== userId) {
        // If you want only creator to rename, uncomment next line
        // return res.status(403).json({ error: 'Only creator can rename group' });
      }
      chat.name = name.trim();
    }

    // Membership update (only creator allowed)
    if (Array.isArray(users)) {
      // Migrate creator if missing
      if (!chat.creator && chat.isGroup) {
        chat.creator = chat.users?.[0] || userId;
      }
  const isCreator = chat.creator && chat.creator.toString() === userId;
  const isFirstUser = chat.users?.[0] && chat.users[0].toString() === userId;
      console.log('[update-group] chatId=%s requester=%s creator=%s isCreator=%s isFirstUser=%s usersBefore=%j usersRequested=%j', chatId, userId, chat.creator, isCreator, isFirstUser, chat.users, users);
      if (!(isCreator || isFirstUser)) {
        return res.status(403).json({ error: 'Only creator can update members', reason: 'not-creator', meta: { creator: chat.creator, requester: userId, isCreator, isFirstUser } });
      }
      const unique = Array.from(new Set(users.map(u => u.toString())));
      if (chat.creator && !unique.includes(chat.creator.toString())) unique.push(chat.creator.toString());
      chat.users = unique;
    }

    await chat.save();

    const updated = await Chat.findById(chatId)
      .populate('users', 'firstname lastname email name');
    const io = req.app.get('io');
    if (io && updated) {
      io.emit('chatMembersUpdated', { chatId: updated._id, users: updated.users, name: updated.name });
    }
    return res.json(updated);
  } catch (err) {
    console.error('❌ PUT /api/chats/:chatId error:', err);
    return res.status(500).json({ error: 'Failed to update group' });
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
  if (!chat.users.some(u => u.toString() === userId)) {
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

// POST /api/chats/:chatId/dedupe - utility to remove duplicate members (creator or first user)
router.post('/:chatId/dedupe', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = String(req.user.id);
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    if (!chat.creator && chat.users?.length) chat.creator = chat.users[0];
    const isCreator = chat.creator && chat.creator.toString() === userId;
    const isFirstUser = chat.users?.[0] && chat.users[0].toString() === userId;
    if (!(isCreator || isFirstUser)) return res.status(403).json({ error: 'Forbidden' });
    chat.users = Array.from(new Set(chat.users.map(u => u.toString())));
    await chat.save();
    const updated = await Chat.findById(chatId).populate('users','firstname lastname email name');
    return res.json(updated);
  } catch (err) {
    console.error('❌ POST /api/chats/:chatId/dedupe error:', err);
    return res.status(500).json({ error: 'Failed to dedupe members' });
  }
});
