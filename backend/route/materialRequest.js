const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/materialRequestController');
const { verifyIT } = require('../middleware/authMiddleware');


// Use memory storage – files will be pushed to Supabase, not local disk
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 25 * 1024 * 1024 } });

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

// SIGNED URLS FOR ATTACHMENTS
router.get('/:id/attachments/signed', verifyToken, controller.getMaterialRequestAttachmentSignedUrls);

// DELETE
router.delete('/:id', verifyToken, controller.deleteMaterialRequest);

// APPROVE (allow optional purchase order upload at AM stage)
router.post('/:id/approve', verifyToken, upload.single('purchaseOrder'), controller.approveMaterialRequest);


// MARK AS RECEIVED
router.patch('/:id/received', verifyToken, controller.markReceived);

// ARCHIVE AND DELETE ARCHIVED REQUESTS
router.put('/:id/archive', verifyToken, controller.archiveMaterialRequest);
router.delete('/:id/archived', verifyToken, controller.deleteArchivedRequest);

router.post('/:id/nudge', verifyToken, controller.nudgePendingApprover);

module.exports = router;
