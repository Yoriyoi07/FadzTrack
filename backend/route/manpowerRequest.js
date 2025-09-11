const express = require('express');
const router = express.Router();
const multer = require('multer');
const ManpowerRequest = require('../models/ManpowerRequest'); 
const Manpower = require('../models/Manpower');
const {
  createManpowerRequest,
  getAllManpowerRequests,
  updateManpowerRequest,
  deleteManpowerRequest,
  getManpowerRequestsForAreaManager,
  getManpowerRequestsForProjectManagers,
  approveManpowerRequest,
  rejectManpowerRequest,
  getMyManpowerRequests,
  getSingleManpowerRequest,
  markManpowerRequestReceived,
  scheduleManpowerReturn,
  markRequestCompleted,
  archiveManpowerRequest,
  deleteArchivedRequest,
  testArchiveRequests,
  debugArchiveState
} = require('../controllers/manpowerRequestController');
const { verifyToken } = require('../middleware/authMiddleware');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Create request (protected)
router.post('/', verifyToken, createManpowerRequest);

// User-specific requests (protected)
router.get('/mine', verifyToken, getMyManpowerRequests);

// Area Manager inbox (optionally protected, making it protected here)
router.get('/area', verifyToken, getManpowerRequestsForAreaManager);

// NEW: Project Managers inbox (protected)
router.get('/pm', verifyToken, getManpowerRequestsForProjectManagers);

// All requests (could be protected if needed)
router.get('/', getAllManpowerRequests);

// Schedule a return date on a request (validated)
router.put('/:id/return', verifyToken, scheduleManpowerReturn);

// Inactive manpower list (protected)
router.get('/inactive', verifyToken, async (req, res) => {
  try {
    const manpowers = await Manpower.find({ status: 'Inactive' }).select('name position status');
    console.log('✅ Found inactive manpowers:', manpowers);
    res.json(manpowers);
  } catch (err) {
    console.error('❌ Error fetching inactive manpower:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch specific request (protected)
router.get('/:id', verifyToken, getSingleManpowerRequest);

// Update, delete, approve, mark received (protected)
router.put('/:id', verifyToken, updateManpowerRequest);
router.delete('/:id', verifyToken, deleteManpowerRequest);

router.put('/:id/approve', (req, res, next) => {
  console.log("HIT /:id/approve route");
  next();
}, verifyToken, approveManpowerRequest);

router.put('/:id/reject', verifyToken, rejectManpowerRequest);

router.put('/:id/received', verifyToken, markManpowerRequestReceived);

// Mark request as completed (when manpower returns)
router.put('/:id/complete', verifyToken, markRequestCompleted);

// Archive a request
router.put('/:id/archive', verifyToken, archiveManpowerRequest);

// Permanently delete an archived request
router.delete('/:id/archived', verifyToken, deleteArchivedRequest);

// Test endpoint to manually trigger archiving (for debugging)
router.post('/test-archive', verifyToken, testArchiveRequests);

// Debug endpoint to check current state
router.get('/debug-archive', verifyToken, debugArchiveState);

module.exports = router;
