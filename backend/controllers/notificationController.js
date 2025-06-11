const Notification = require('../models/Notification');

exports.createNotification = async (req, res) => {
  console.log("Create notification called", req.body);
  try {
    const notif = await Notification.create(req.body);

    // SOCKET.IO: emit real-time notification if user online
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const { toUserId } = notif;

    console.log("Current userSockets mapping:", userSockets);
    if (userSockets && userSockets[toUserId]) {
      console.log(`Emitting notification to socket ${userSockets[toUserId]}`);
      io.to(userSockets[toUserId]).emit("notification", notif);
    } else {
      console.log("User is not online / not registered, can't send socket notification");
    }

    res.json(notif);
  } catch (err) {
    console.error("Notification creation error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ toUserId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { ids } = req.body;
    await Notification.updateMany(
      { _id: { $in: ids }, toUserId: req.user._id },
      { $set: { status: 'read' } }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { toUserId: req.user._id, status: 'unread' },
      { $set: { status: 'read' } }
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
