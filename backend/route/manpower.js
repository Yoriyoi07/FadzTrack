const express = require('express');
const router = express.Router();
const { getAllManpower, uploadManpowerFromCSV , getUnassignedManpower} = require('../controllers/manpowerController');

router.get('/', getAllManpower);
router.get('/unassigned', getUnassignedManpower); 
router.post('/bulk', uploadManpowerFromCSV);  

module.exports = router;
