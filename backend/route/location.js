const express = require('express');
const router = express.Router();
const Location = require('../models/Location');

// Get all locations
router.get('/', async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch locations' });
  }
});

// (Optional) Add new location
router.post('/', async (req, res) => {
  try {
    const { name, region } = req.body;
    const loc = new Location({ name, region });
    await loc.save();
    res.status(201).json(loc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add location' });
  }
});

module.exports = router;
