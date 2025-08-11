// routes/messageRoutes.js
const express         = require('express');
const multer          = require('multer');
const path            = require('path');
const mongoose        = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const Message         = require('../models/Messages');
const Chat            = require('../models/Chats');

const router = express.Router();
router.use(verifyToken);

/* ----------------------------- Multer (files) ----------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  }
});
const upload = multer({ storage });

/* ------------------------- GET /api/messages/:chatId ---------------------- */
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ error: 'Invalid chatId' });
    }

    const msgs = await Message.find({ conversation: chatId })
      .populate('sender', 'firstname lastname _id') // preserve your populate
      .sort({ createdAt: 1 });

    const out = msgs.map(m => ({
      _id:          m._id,
      conversation: m.conversation,
      senderId:     m.sender?._id,                     // alias used by client
      message:      m.type === 'text' ? m.content : null,
      fileUrl:      m.fileUrl || null,
      type:         m.type,
      reactions:    m.reactions || [],
      seen:         m.seen || [],
      createdAt:    m.createdAt,
      updatedAt:    m.updatedAt
    }));

    return res.json(out);
  } catch (err) {
    console.error('❌ GET /api/messages/:chatId error:', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/* ---------------------------- POST /api/messages -------------------------- */
/**
 * Accepts either:
 * - Text: JSON { sender, conversation, content, type: 'text', clientId? }
 * - File: multipart/form-data with field "file", plus { sender, conversation, type?, clientId? }
 *   (If "type" omitted and file provided, we set type='file')
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const io = req.app.get('io');

    const { sender, conversation, clientId } = req.body;
    let { type, content } = req.body;

    if (!sender || !conversation) {
      return res.status(400).json({ error: 'sender and conversation are required' });
    }
    if (!mongoose.isValidObjectId(sender) || !mongoose.isValidObjectId(conversation)) {
      return res.status(400).json({ error: 'Invalid sender or conversation id' });
    }

    const chat = await Chat.findById(conversation);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const payload = {
      sender,
      conversation,
      type: 'text',
      reactions: [],
      seen: [],
    };

    if (req.file) {
      // file upload case
      payload.type    = type && type !== 'text' ? type : 'file';
      payload.fileUrl = `/uploads/${req.file.filename}`;
    } else {
      // text case
      payload.type = type || 'text';
      payload.content = content || '';
      if (!payload.content && !payload.fileUrl) {
        return res.status(400).json({ error: 'Message content or file is required' });
      }
    }

    // 1) Save
    const msg = await Message.create(payload);

    // 2) Update chat preview
    try {
      await Chat.findByIdAndUpdate(conversation, {
        lastMessage: {
          content: payload.type === 'text' ? payload.content : payload.fileUrl,
          timestamp: msg.createdAt
        }
      });
    } catch (e) {
      console.warn('⚠️ Failed to update chat preview:', e?.message);
    }

    // 3) Re-fetch populated for consistent response
    const populated = await Message.findById(msg._id)
      .populate('sender', 'firstname lastname _id');

    const out = {
      _id:          populated._id,
      conversation: populated.conversation,
      senderId:     populated.sender?._id,
      message:      populated.type === 'text' ? populated.content : null,
      fileUrl:      populated.fileUrl || null,
      type:         populated.type,
      reactions:    populated.reactions || [],
      seen:         populated.seen || [],
      createdAt:    populated.createdAt,
      updatedAt:    populated.updatedAt
    };

    // 4) 🔊 Real-time emits (echo clientId; also include senderId)
    const room = String(conversation);

    io.to(room).emit('receiveMessage', {
      _id:          String(out._id),
      conversation: room,
      sender:       String(out.senderId),           // some clients use 'sender'
      senderId:     String(out.senderId),           // your client uses senderId
      content:      out.message ?? out.fileUrl ?? '',// normalized content
      type:         out.type,
      fileUrl:      out.fileUrl,
      timestamp:    out.createdAt,
      reactions:    out.reactions,
      seen:         out.seen,
      clientId:     req.body.clientId || null,      // <-- important for de-dupe on client
    });

    io.emit('chatUpdated', {
      chatId: room,
      lastMessage: { content: out.message ?? out.fileUrl, timestamp: out.createdAt }
    });

    return res.status(201).json(out);
  } catch (err) {
    console.error('❌ POST /api/messages error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

/* ------------------- POST /api/messages/:id/reactions --------------------- */
router.post('/:messageId/reactions', async (req, res) => {
  try {
    const io = req.app.get('io');
    const { userId, emoji } = req.body;
    const { messageId } = req.params;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    // Replace previous reaction from same user
    msg.reactions = msg.reactions.filter(r => r.userId.toString() !== String(userId));
    msg.reactions.push({ userId, emoji });
    await msg.save();

    io.to(msg.conversation.toString()).emit('messageReaction', {
      messageId: String(messageId),
      reactions: msg.reactions
    });

    return res.json(msg);
  } catch (err) {
    console.error('❌ POST reactions error:', err);
    return res.status(500).json({ error: 'Failed to add/replace reaction' });
  }
});

/* ------------------ DELETE /api/messages/:id/reactions -------------------- */
router.delete('/:messageId/reactions', async (req, res) => {
  try {
    const io = req.app.get('io');
    const { userId, emoji } = req.body;
    const { messageId } = req.params;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    msg.reactions = msg.reactions.filter(
      r => !(r.userId.toString() === String(userId) && r.emoji === emoji)
    );
    await msg.save();

    io.to(msg.conversation.toString()).emit('messageReaction', {
      messageId: String(messageId),
      reactions: msg.reactions
    });

    return res.json(msg);
  } catch (err) {
    console.error('❌ DELETE reactions error:', err);
    return res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

/* ---------------------- POST /api/messages/:id/seen ----------------------- */
router.post('/:messageId/seen', async (req, res) => {
  try {
    const io = req.app.get('io');
    const { userId } = req.body;
    const { messageId } = req.params;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (!msg.seen.some(s => s.userId.toString() === String(userId))) {
      const seenEntry = { userId, timestamp: Date.now() };
      msg.seen.push(seenEntry);
      await msg.save();

      io.to(msg.conversation.toString()).emit('messageSeen', {
        messageId: String(messageId),
        userId:    String(seenEntry.userId),
        timestamp: seenEntry.timestamp
      });
    }

    return res.json(msg);
  } catch (err) {
    console.error('❌ POST seen error:', err);
    return res.status(500).json({ error: 'Failed to mark seen' });
  }
});

module.exports = router;
