const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, async (req, res) => {
   if (req.user.role !== 'CEO' && req.user.role !== 'HR') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .populate('performedBy', 'name email role');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;
