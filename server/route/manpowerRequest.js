const express = require('express');
const router = express.Router();
const multer = require('multer');
const ManpowerRequest = require('../models/ManpowerRequest'); 
const {
  createManpowerRequest,
  getAllManpowerRequests,
  updateManpowerRequest,
  deleteManpowerRequest,
  getManpowerRequestsForAreaManager,
  approveManpowerRequest,
  getMyManpowerRequests,
  getSingleManpowerRequest,
  markManpowerRequestReceived,
  scheduleManpowerReturn
} = require('../controllers/manpowerRequestController');
const { verifyToken } = require('../middleware/authMiddleware'); // Import this

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// POST is always protected
router.post('/', verifyToken, createManpowerRequest);

// Protected user-specific requests
router.get('/mine', verifyToken, getMyManpowerRequests); // <-- for logged-in user's own requests

// Area Manager (could also protect this if needed)
router.get('/area', getManpowerRequestsForAreaManager);

// All requests (public, but you can protect it if you want)
router.get('/', getAllManpowerRequests);

// routes/manpowerRequests.js
router.put('/:id/return', async (req, res) => {
  console.log("BODY:", req.body); // add this
  console.log("ID:", req.params.id);
  const { returnDate } = req.body;
  try {
    const updated = await ManpowerRequest.findByIdAndUpdate(
      req.params.id,
      { returnDate },
      { new: true }
    );
    console.log("UPDATED:", updated); // add this
    res.json(updated);
  } catch (err) {
    console.error(err); // add this
    res.status(500).json({ error: 'Failed to set return date' });
  }
});

// Fetch a specific request (should be protected!)
router.get('/:id', verifyToken, getSingleManpowerRequest);

// Update, delete, approve, mark received, schedule return (all should be protected)
router.put('/:id', verifyToken, updateManpowerRequest);
router.delete('/:id', verifyToken, deleteManpowerRequest);
router.put('/:id/approve', (req, res, next) => {
  console.log("HIT /:id/approve route");
  next();
}, verifyToken, approveManpowerRequest);
router.put('/:id/received', verifyToken, markManpowerRequestReceived);

module.exports = router;
