const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');


router.get('/search', async (req, res) => {
  const query = req.query.query;
  try {
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ]
    }).select('-password'); // hide password
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Fetch users by role
router.get('/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users by role:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// GET: Locations assigned to user (for dropdown)
router.get('/:userId/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate('locations');  // Use populate to get full location data

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.locations);  // Send populated locations
  } catch (err) {
    console.error('Error fetching assigned locations:', err);
    res.status(500).json({ message: 'Failed to fetch assigned locations' });
  }
});

// PUT: Update assigned locations for user
router.put('/:userId/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { locations } = req.body;  // Array of location IDs to be updated

    // Find the user and update their locations
    const user = await User.findByIdAndUpdate(
      userId,
      { locations },  // Update the locations field with the new locations
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return the updated user
    res.json(user.locations);
  } catch (err) {
    console.error('Error updating locations:', err);
    res.status(500).json({ message: 'Failed to update locations' });
  }
});

// GET: Assigned projects for user (PIC or PM)
router.get('/assigned/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'PIC' || user.role === 'Person in Charge') {
      const project = await Project.findOne({ pic: userId });
      if (!project) return res.status(404).json({ message: 'No project assigned to this PIC' });
      return res.json([project]);
    }

    const projects = await Project.find({
      $or: [
        { projectmanager: userId },
        { pic: userId }
      ]
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET all PICs who are NOT assigned as PIC to any ONGOING project
// GET all PICs who are NOT assigned as PIC to any ONGOING project
router.get('/unassigned-pics', async (req, res) => {
  try {
    const unassignedPICs = await User.aggregate([
      { $match: { role: { $in: ["PIC", "Person in Charge"] } } },
      {
        $lookup: {
          from: 'projects',
          let: { pic_id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$$pic_id', '$pic'] },    // <<== correct for array of PICs
                    { $eq: ['$status', 'Ongoing'] }
                  ]
                }
              }
            }
          ],
          as: 'assigned_ongoing_projects'
        }
      },
      { $match: { 'assigned_ongoing_projects': { $size: 0 } } },
      { $project: { name: 1, _id: 1 } }
    ]);

    res.json(unassignedPICs);
  } catch (err) {
    console.error("Error fetching unassigned PICs:", err);
    res.status(500).json({ message: 'Failed to fetch unassigned PICs' });
  }
});



// GET all PMs who are NOT assigned as PM to any ONGOING project
router.get('/unassigned-pms', async (req, res) => {
  try {
    const unassignedPMs = await User.aggregate([
      { $match: { role: "Project Manager" } },
      {
        $lookup: {
          from: 'projects',
          let: { pm_id: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$projectmanager', '$$pm_id'] },
              { $eq: ['$status', 'Ongoing'] }
            ]}}},
          ],
          as: 'assigned_ongoing_projects'
        }
      },
      { $match: { 'assigned_ongoing_projects': { $size: 0 } } },
      { $project: { name: 1, _id: 1 } }
    ]);

    res.json(unassignedPMs);
  } catch (err) {
    console.error("Error fetching unassigned PMs:", err);
    res.status(500).json({ message: 'Failed to fetch unassigned PMs' });
  }
});


module.exports = router;
