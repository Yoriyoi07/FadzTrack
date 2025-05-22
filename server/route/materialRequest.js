// route/materialRequest.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const materialRequestController = require('../controllers/materialRequestController');

router.post('/', upload.array('attachments'), materialRequestController.createMaterialRequest);
router.get('/', materialRequestController.getAllMaterialRequests);

module.exports = router;
