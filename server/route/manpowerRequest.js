const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createManpowerRequest,
  getAllManpowerRequests,
  updateManpowerRequest,
  deleteManpowerRequest
} = require('../controllers/manpowerRequestController');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

// Create
router.post('/', upload.array('attachments'), createManpowerRequest);

// Read all
router.get('/', getAllManpowerRequests);

// Update
router.put('/:id', updateManpowerRequest);

// Delete
router.delete('/:id', deleteManpowerRequest);

module.exports = router;
