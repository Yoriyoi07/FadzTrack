const express = require('express');
const router = express.Router();
const { getAllManpower, uploadManpowerFromCSV } = require('../controllers/manpowerController');

router.get('/', getAllManpower);
router.post('/bulk', uploadManpowerFromCSV);  

module.exports = router;
