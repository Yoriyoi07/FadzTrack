const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.post('/', verifyToken, notificationController.createNotification);
router.get('/', verifyToken, notificationController.getNotifications);
router.post('/mark-read', verifyToken, notificationController.markRead);
router.patch('/mark-all-read', verifyToken, notificationController.markAllRead);

module.exports = router;
