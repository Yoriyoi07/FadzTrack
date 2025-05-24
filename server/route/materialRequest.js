// route/materialRequest.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const MaterialRequest = require('../models/MaterialRequest');

// File storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// POST /api/requests
router.post('/', upload.array('attachments'), async (req, res) => {
  try {
    const { materials, description } = req.body;
    const parsedMaterials = JSON.parse(materials);
    const attachments = req.files.map(file => file.filename);

    const newRequest = new MaterialRequest({
      materials: parsedMaterials,
      description,
      attachments
    });

    await newRequest.save();
    res.status(201).json({ message: 'Material request submitted successfully' });
  } catch (error) {
    console.error('❌ Error submitting material request:', error);
    res.status(500).json({ error: 'Failed to submit material request' });
  }
});

module.exports = router;
