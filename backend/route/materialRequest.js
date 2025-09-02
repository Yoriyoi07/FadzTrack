const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/materialRequestController');
const { verifyIT } = require('../middleware/authMiddleware');


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

// CREATE
router.post('/', verifyToken, upload.array('attachments'), controller.createMaterialRequest);

// GET ALL
router.get('/', verifyToken, controller.getAllMaterialRequests);

router.get('/mine', verifyToken, controller.getMyMaterialRequests);

router.get('/all', verifyToken, verifyIT, (req, res, next) => {
  console.log('[GET /all] req.user:', req.user);
  next();
}, controller.getAllMaterialRequests);

// GET ONE
router.get('/:id', verifyToken, controller.getMaterialRequestById);

// UPDATE
router.put('/:id', verifyToken, upload.array('newAttachments'), controller.updateMaterialRequest);

// DELETE
router.delete('/:id', verifyToken, controller.deleteMaterialRequest);

// APPROVE
router.post('/:id/approve', verifyToken, controller.approveMaterialRequest);


// MARK AS RECEIVED
router.patch('/:id/received', verifyToken, controller.markReceived);

router.post('/:id/nudge', verifyToken, controller.nudgePendingApprover);

module.exports = router;
