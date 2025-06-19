const express = require('express');
const router = express.Router();
const controller = require('../controllers/materialController');

router.get('/', controller.getAllMaterials);

module.exports = router;
