// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Project = require('../models/Project');
const dailyReportController = require('../controllers/dailyReportController');

// Apply auth guard to **all** user routes
router.use(verifyToken);

/**
 * GET /api/users
 * List users for sidebar or group modal.
 * Supports optional ?limit=N to page the results.
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10);
    let query = User.find().select('name email _id');
    if (!isNaN(limit) && limit > 0) {
      query = query.limit(limit);
    }
    const users = await query;
    return res.json(users);
  } catch (err) {
    console.error('❌ GET /api/users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/search?query=…
 * Fuzzy‑search users by name or email for starting chats/groups.
 */
router.get('/search', async (req, res) => {
  const q = (req.query.query || '').trim();
  if (!q) {
    return res.json([]);
  }

  try {
    const regex = new RegExp(q, 'i');
    const users = await User.find({
      $or: [
        { name:  regex },
        { email: regex }
      ]
    })
      .select('name email _id');

    return res.json(users);
  } catch (err) {
    console.error('❌ GET /api/users/search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});


/**
 * The rest of your existing user/project routes…
 * (role lookup, locations, assigned projects, unassigned PICs/PMs)
 * remain unchanged below.
 */

 // Fetch users by role
router.get('/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }).select('name _id');
    return res.json(users);
  } catch (err) {
    console.error('❌ GET /api/users/role/:role error:', err);
    return res.status(500).json({ message: 'Failed to fetch users by role' });
  }
});

// GET: Locations assigned to user
router.get('/:userId/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate('locations');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user.locations);
  } catch (err) {
    console.error('❌ GET /api/users/:userId/locations error:', err);
    return res.status(500).json({ message: 'Failed to fetch locations' });
  }
});

// PUT: Update assigned locations for user
router.put('/:userId/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { locations } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { locations },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user.locations);
  } catch (err) {
    console.error('❌ PUT /api/users/:userId/locations error:', err);
    return res.status(500).json({ message: 'Failed to update locations' });
  }
});

// GET: Assigned projects for user (PIC or PM)
router.get('/assigned/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Treat Staff and HR - Site - Site like PIC: only one active project at a time
    if (["PIC", "Person in Charge", "Staff", "HR - Site"].includes(user.role)) {
      const project = await Project.findOne({ pic: userId });
      return project
        ? res.json([project])
        : res.status(404).json({ message: `No project assigned to this ${user.role}` });
    }

    const projects = await Project.find({
      $or: [
        { projectmanager: userId },
        { pic: userId }
      ]
    });
    return res.json(projects);
  } catch (err) {
    console.error('❌ GET /api/users/assigned/:userId error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET all unassigned PICs (includes Staff and HR - Site as single-project roles)
router.get('/unassigned-pics', async (req, res) => {
  try {
    const unassignedPICs = await User.aggregate([
      { $match: { role: { $in: ['PIC', 'Person in Charge', 'Staff', 'HR - Site'] } } },
      {
        $lookup: {
          from: 'projects',
          let: { pic_id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$$pic_id', '$pic'] },
                    { $eq: ['$status', 'Ongoing'] }
                  ]
                }
              }
            }
          ],
          as: 'assigned_ongoing_projects'
        }
      },
      { $match: { assigned_ongoing_projects: { $size: 0 } } },
      { $project: { name: 1, _id: 1 } }
    ]);
    return res.json(unassignedPICs);
  } catch (err) {
    console.error('❌ GET /api/users/unassigned-pics error:', err);
    return res.status(500).json({ message: 'Failed to fetch unassigned PICs' });
  }
});

// GET all unassigned PMs
router.get('/unassigned-pms', async (req, res) => {
  try {
    const unassignedPMs = await User.aggregate([
      { $match: { role: 'Project Manager' } },
      {
        $lookup: {
          from: 'projects',
          let: { pm_id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$projectmanager', '$$pm_id'] },
                    { $eq: ['$status', 'Ongoing'] }
                  ]
                }
              }
            }
          ],
          as: 'assigned_ongoing_projects'
        }
      },
      { $match: { assigned_ongoing_projects: { $size: 0 } } },
      { $project: { name: 1, _id: 1 } }
    ]);
    return res.json(unassignedPMs);
  } catch (err) {
    console.error('❌ GET /api/users/unassigned-pms error:', err);
    return res.status(500).json({ message: 'Failed to fetch unassigned PMs' });
  }
});


module.exports = router;
