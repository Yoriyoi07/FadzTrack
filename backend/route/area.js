const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const Area = require('../models/Area');

// Protect all area routes
router.use(verifyToken);

// GET /api/areas  -> list all non-deleted areas, populate manager basic info
router.get('/', async (req, res) => {
  try {
    const areas = await Area.find({ isDeleted: { $ne: true } })
      .populate('areaManager', 'name email role');
    res.json(areas);
  } catch (err) {
    console.error('GET /api/areas error:', err);
    res.status(500).json({ message: 'Failed to fetch areas' });
  }
});

// POST /api/areas  (minimal creator) – optional convenience
router.post('/', async (req, res) => {
  try {
    const { name, description = '', areaManager } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const area = new Area({ name: name.trim(), description, areaManager });
    await area.save();
    const populated = await Area.findById(area._id).populate('areaManager', 'name email role');
    res.status(201).json(populated);
  } catch (err) {
    console.error('POST /api/areas error:', err);
    res.status(500).json({ message: 'Failed to create area' });
  }
});

module.exports = router;