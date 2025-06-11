const Notification = require('../models/Notification');

// Helper for code (call from anywhere in code, e.g. materialRequestController)
exports.createAndEmitNotification = async ({
  type,
  toUserId,
  fromUserId,
  message,
  projectId,
  requestId,
  meta,
  req
}) => {
  const notif = await Notification.create({
    type, toUserId, fromUserId, message, projectId, requestId, meta
  });
  const io = req.app.get('io');
  const userSockets = req.app.get('userSockets');
  const socketId = userSockets[toUserId.toString()];
  if (io && socketId) {
    io.to(socketId).emit('notification', notif);
  }
  return notif;
};

// REST endpoint to create notification via POST /api/notifications
exports.createNotification = async (req, res) => {
  try {
    const { type, toUserId, message, projectId, requestId, meta } = req.body;
    const notif = await Notification.create({
      type, toUserId, fromUserId: req.user.id, message, projectId, requestId, meta
    });

    // Emit via Socket.IO (optional, for real-time)
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const socketId = userSockets[toUserId.toString()];
    if (io && socketId) {
      io.to(socketId).emit('notification', notif);
    }

    res.status(201).json(notif);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ toUserId: req.user.id })
      .sort({ createdAt: -1 }).limit(50);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark notifications as read
exports.markRead = async (req, res) => {
  try {
    const { ids } = req.body;
    await Notification.updateMany(
      { _id: { $in: ids }, toUserId: req.user.id },
      { $set: { status: 'read' } }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark all as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { toUserId: req.user.id, status: 'unread' },
      { $set: { status: 'read' } }
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
