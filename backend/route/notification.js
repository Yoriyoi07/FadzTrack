const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.post('/', verifyToken, notificationController.createNotification);
router.get('/', verifyToken, notificationController.getNotifications);
router.post('/mark-read', verifyToken, notificationController.markRead);
// Allow PATCH as well for clients using semantic partial updates
router.patch('/mark-read', verifyToken, notificationController.markRead);
router.patch('/mark-all-read', verifyToken, notificationController.markAllRead);

// Temporary test route (no auth) to create a notification for debugging
router.get('/test-create', async (req, res) => {
	try {
		const toUserId = req.query.to || req.query.userId;
		if (!toUserId) return res.status(400).json({ message: 'Provide ?to=<userId>' });

		const notif = await notificationController.createAndEmitNotification({
			type: 'general',
			toUserId,
			fromUserId: null,
			message: `Test notification at ${new Date().toISOString()}`,
			projectId: null,
			requestId: null,
			meta: { debug: true },
			req
		});

		res.json({ created: !!notif, notif });
	} catch (err) {
		console.error('Test create notification error:', err);
		res.status(500).json({ message: err.message });
	}
});

// Temporary debug route: show registered socket ids for a user
router.get('/debug-sockets', (req, res) => {
	try {
		const userId = req.query.userId || req.query.to;
		if (!userId) return res.status(400).json({ message: 'Provide ?userId=<id>' });
		const userSockets = req.app.get('userSockets');
		if (!userSockets || typeof userSockets.get !== 'function') return res.status(500).json({ message: 'userSockets not configured' });
		const sockets = userSockets.get(String(userId));
		return res.json({ userId: String(userId), sockets: sockets ? Array.from(sockets) : [] });
	} catch (err) {
		console.error('Debug sockets error:', err);
		res.status(500).json({ message: err.message });
	}
});

// Temporary debug route to inspect registered socket ids for a user
router.get('/debug-sockets', (req, res) => {
	try {
		const userSockets = req.app.get('userSockets');
		if (!userSockets || typeof userSockets.get !== 'function') {
			return res.status(500).json({ message: 'userSockets not available on server' });
		}

		const userId = req.query.user;
		if (userId) {
			const set = userSockets.get(String(userId));
			return res.json({ userId: String(userId), sockets: set ? Array.from(set) : [] });
		}

		// Return summary of all users (careful: only for debug)
		const summary = {};
		for (const [uid, set] of userSockets.entries()) {
			summary[uid] = Array.from(set);
		}
		res.json({ users: Object.keys(summary).length, summary });
	} catch (err) {
		console.error('debug-sockets error:', err);
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;
