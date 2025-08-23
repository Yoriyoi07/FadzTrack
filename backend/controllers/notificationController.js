const Notification = require('../models/Notification');

// Helper function to create and emit notifications
exports.createAndEmitNotification = async ({
  type,
  toUserId,
  fromUserId,
  message,
  projectId,
  requestId,
  meta,
  referenceId, // New field to handle dynamic reference (e.g., discussion, reply)
  req,
}) => {
  try {
  console.log('[createAndEmitNotification] called with:', { type, toUserId, fromUserId, projectId, requestId, meta, referenceId });
    // Create the notification
    const notif = await Notification.create({
      type,
      toUserId,
      fromUserId,
      message,
      projectId,
      requestId,
      meta,
      referenceId,
    });
console.log("Notification created:", notif);
    // Emit the notification via Socket.IO (if available)
    if (!req || !req.app) {
      console.warn('No req.app available for emit; notification saved but not emitted.');
      return notif;
    }
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets'); // expected Map

    if (!userSockets || typeof userSockets.get !== 'function') {
      console.warn('userSockets not configured as Map on app');
      return notif;
    }

    const socketIds = userSockets.get(String(toUserId));
    if (!socketIds || socketIds.size === 0) {
      console.log(`No active socket connections for userId: ${toUserId}`);
      return notif;
    }

    console.log(`Emitting notification to userId: ${toUserId}, socketId(s): ${Array.from(socketIds)}`);

    if (io) {
      // iterate the Set of socketIds and emit individually
      socketIds.forEach((sid) => {
        try {
          io.to(sid).emit('notification', notif);
        } catch (err) {
          console.error('Emit error to socket', sid, err);
        }
      });
    }

    return notif;
  } catch (err) {
    console.error('Error creating and emitting notification:', err);
    throw new Error('Notification creation failed');
  }
};


// Create a notification via API
exports.createNotification = async (req, res) => {
  try {
    const { type, toUserId, message, projectId, requestId, meta } = req.body;

    const notif = await Notification.create({
      type,
      toUserId,
      fromUserId: req.user.id,
      message,
      projectId,
      requestId,
      meta,
    });
console.log("Notification created via API:", notif);
    // Emit via Socket.IO using app-stored Map
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets'); // Map
    try {
      if (userSockets && typeof userSockets.get === 'function') {
        const socketIds = userSockets.get(String(toUserId));
        if (io && socketIds && socketIds.size) {
          socketIds.forEach((sid) => {
            try { io.to(sid).emit('notification', notif); } catch (e) { console.error('Emit error', e); }
          });
        } else {
          console.log(`No active sockets to emit for user ${toUserId}`);
        }
      } else {
        console.warn('userSockets not available on app for emit');
      }
    } catch (emitErr) {
      console.error('Error while emitting notification via createNotification:', emitErr);
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
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark specific notifications as read
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

// Mark all notifications as read
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