const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  generateAttendanceReport,
  submitAttendanceReport,
  getAttendanceReports
} = require('../controllers/hrSiteController');

// Generate attendance report
router.post('/generate', verifyToken, upload.array('files'), generateAttendanceReport);

// Submit attendance report
router.post('/submit', verifyToken, submitAttendanceReport);

// Get attendance reports for a user
router.get('/reports', verifyToken, getAttendanceReports);

module.exports = router;
