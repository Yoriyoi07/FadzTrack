const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, async (req, res) => {
  try {
  let filter = {};
  const { projectId, action, role } = req.query;
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

    if (projectId) {
      filter['meta.projectId'] = projectId;
    }
    if (action) {
      filter.action = { ...(filter.action || {}), $regex: new RegExp(action, 'i') };
    }
    if (role) {
      filter.performedByRole = { $regex: new RegExp(role, 'i') };
    }

    let logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .populate('performedBy', 'name email role');

    // Post-enrichment for any missing projectName (batch to avoid N+1)
    const missingProjectIds = Array.from(new Set(logs
      .filter(l => l.meta?.projectId && !l.meta.projectName)
      .map(l => l.meta.projectId)));
    if (missingProjectIds.length) {
      const projects = await require('../models/Project').find({ _id: { $in: missingProjectIds } }).select('projectName');
      const projMap = new Map(projects.map(p => [String(p._id), p.projectName]));
      logs = logs.map(l => {
        if (l.meta?.projectId && !l.meta.projectName) {
          const copy = l.toObject();
          copy.meta.projectName = projMap.get(String(copy.meta.projectId));
          return copy;
        }
        return l;
      });
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;
