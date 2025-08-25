// route/messageRoutes.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { logAction } = require('../utils/auditLogger');

const Message = require('../models/Messages');
const Chat    = require('../models/Chats');
const supabase = require('../utils/supabaseClient');

// use memory storage and upload to Supabase private bucket 'message'
const storage = multer.memoryStorage();

// accept common images/videos/audio/docs
const fileFilter = (_req, file, cb) => {
  const ok = [
    /^image\//, /^video\//, /^audio\//,
    /pdf$/, /msword$/, /vnd.openxmlformats-officedocument/,
    /excel$/, /spreadsheetml/, /text\/plain$/,
    /csv$/, /powerpoint$/, /presentation/
  ].some(rx => rx.test(file.mimetype));
  cb(ok ? null : new Error('Unsupported file type'), ok);
};

const uploadMulter = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 } // 25MB each, up to 10 files
});

// ---------- auth ----------
router.use(verifyToken);

// GET /api/messages/:chatId  -> list messages
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.users.map(String).includes(String(req.user.id)))
      return res.status(403).json({ error: 'Access denied' });

  const msgs = await Message.find({ conversation: chatId }).sort({ createdAt: 1 }).lean();
    // convert any attachment.path to a fresh signed URL (short-lived)
    const bucket = 'message';
    for (const m of msgs) {
      if (Array.isArray(m.attachments) && m.attachments.length) {
        const conv = m;
        const items = [];
        for (const a of (conv.attachments || [])) {
          if (a.path) {
            try {
              const { data: urlData, error } = await supabase.storage.from(bucket).createSignedUrl(a.path, 60 * 60);
              items.push({ ...a, url: urlData?.signedUrl || a.url });
            } catch (e) {
              console.error('Error creating signed url for attachment:', e);
              items.push(a);
            }
          } else {
            items.push(a);
          }
        }
        m.attachments = items;
      }
    }

  return res.json(msgs);
  } catch (err) {
    console.error('❌ GET /messages/:chatId', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages  -> create text and/or file message (multipart supported)
router.post('/', uploadMulter.any(), async (req, res) => {
    try {
      const userId = req.user.id;
  // content can come from multipart/form-data or JSON body
  const { conversation, content, replyTo, forwardOf } = req.body; // content is text

      const chat = await Chat.findById(conversation);
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
      if (!chat.users.map(String).includes(String(userId)))
        return res.status(403).json({ error: 'Access denied' });

      // build attachments by uploading to Supabase private bucket 'message'
      const bucket = 'message';
      const files = [];
  for (const f of (req.files || [])) {
        try {
          const ts = Date.now();
          const safe = (f.originalname || 'file').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
          const key = `messages/${conversation}/${ts}-${safe}`;
          const { data, error } = await supabase.storage.from(bucket).upload(key, f.buffer, { contentType: f.mimetype, upsert: false });
          if (error) {
            console.error('Supabase upload error (message):', error);
            // fallback to skipping this file
            continue;
          }

          // create short signed url for immediate client consumption (e.g., 1 hour)
          const { data: urlData, error: urlErr } = await supabase.storage.from(bucket).createSignedUrl(key, 60 * 60);
          const publicUrl = urlData?.signedUrl || null;

          files.push({
            url: publicUrl || `supabase:${key}`,
            path: key,
            name: f.originalname || safe,
            size: f.size || (f.buffer ? f.buffer.length : 0),
            mime: f.mimetype,
          });
        } catch (e) {
          console.error('Error uploading attachment to supabase:', e);
        }
      }

      if (!content && files.length === 0) {
        return res.status(400).json({ error: 'Nothing to send' });
      }

      const msg = await Message.create({
        conversation,
        senderId: userId,
        message: (content || '').trim(),
        attachments: files,
        replyTo: replyTo || undefined,
        forwardOf: forwardOf || undefined,
      });

      // Log file uploads if any
      if (files.length > 0) {
        try {
          await logAction({
            action: 'UPLOAD_CHAT_FILES',
            performedBy: userId,
            performedByRole: req.user.role,
            description: `Uploaded ${files.length} file(s) to chat conversation`,
            meta: { 
              conversationId: conversation,
              messageId: msg._id,
              filesCount: files.length,
              fileNames: files.map(f => f.name),
              fileTypes: files.map(f => f.mime),
              totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
            }
          });
        } catch (logErr) {
          console.error('Audit log error (uploadChatFiles):', logErr);
        }
      }

      // Update lastMessage for chat (text preview or label)
      const preview =
        (msg.message && msg.message.trim()) ||
        (files.length === 1
          ? (files[0].mime?.startsWith('image/') ? '📷 Photo' :
             files[0].mime?.startsWith('video/') ? '🎥 Video' :
             files[0].mime?.startsWith('audio/') ? '🎵 Audio' :
             `📎 ${files[0].name}`)
          : `📎 ${files.length} attachments`);

      chat.lastMessage = { content: preview, timestamp: msg.createdAt };
      await chat.save();

      // Socket broadcast
      const io = req.app.get('io');
      if (io) {
        // emit within room
        io.to(String(conversation)).emit('receiveMessage', {
          _id: String(msg._id),
          conversation: String(conversation),
          sender: String(userId),
          content: msg.message || (files[0]?.url ?? ''),
          timestamp: msg.createdAt,
          attachments: msg.attachments,
          replyTo: msg.replyTo ? String(msg.replyTo) : null,
          forwardOf: msg.forwardOf ? String(msg.forwardOf) : null,
        });

        // also refresh left sidebar previews
        io.emit('chatUpdated', {
          chatId: String(conversation),
          lastMessage: chat.lastMessage
        });
      }

  return res.status(201).json(msg);
    } catch (err) {
      console.error('❌ POST /messages', err);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// --- reactions endpoints (keep your existing semantics) ---
router.post('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;
    await Message.updateOne(
      { _id: messageId, 'reactions.userId': { $ne: userId } },
      { $push: { reactions: { userId, emoji } } }
    );
    const msg = await Message.findById(messageId);

    const io = req.app.get('io');
    if (io) io.to(String(msg.conversation)).emit('messageReaction', { messageId, reactions: msg.reactions });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e); return res.status(500).json({ error: 'Failed to react' });
  }
});

// DELETE /api/messages/:id  (soft delete own message)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (String(msg.senderId) !== String(userId)) return res.status(403).json({ error: 'Cannot delete others\' messages' });
    if (msg.deleted) return res.json({ ok: true });
    msg.deleted = true; msg.deletedAt = new Date(); msg.deletedBy = userId; msg.message = '[deleted]';
    await msg.save();
    const io = req.app.get('io');
    if (io) io.to(String(msg.conversation)).emit('receiveMessage', { _id: String(msg._id), conversation: String(msg.conversation), sender: String(msg.senderId), content: msg.message, timestamp: msg.updatedAt, attachments: [], replyTo: msg.replyTo ? String(msg.replyTo) : null, forwardOf: msg.forwardOf ? String(msg.forwardOf) : null });
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /messages/:id', e); return res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.delete('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;
    await Message.updateOne(
      { _id: messageId },
      { $pull: { reactions: { userId, emoji } } }
    );
    const msg = await Message.findById(messageId);
    const io = req.app.get('io');
    if (io) io.to(String(msg.conversation)).emit('messageReaction', { messageId, reactions: msg.reactions });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e); return res.status(500).json({ error: 'Failed to unreact' });
  }
});

module.exports = router;
