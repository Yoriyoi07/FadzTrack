const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, async (req, res) => {
  try {
    let filter = {};
    // IT: See everything
    if (req.user.role === 'IT') {
      // No filter
    }
    // CEO & HR: See everything except login/logout
    else if (req.user.role === 'CEO' || req.user.role === 'HR') {
      filter.action = { $nin: ['login', 'logout'] };
    }
    // Others: Forbidden
    else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .populate('performedBy', 'name email role');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;
