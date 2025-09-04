const express = require('express');
const router = express.Router();
const { getAllManpower, createManpower, uploadManpowerFromCSV , getUnassignedManpower, updateManpower} = require('../controllers/manpowerController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', getAllManpower);
router.get('/unassigned', getUnassignedManpower); 
router.post('/', verifyToken, createManpower);
router.post('/bulk', uploadManpowerFromCSV);  
router.put('/:id', verifyToken, updateManpower);

module.exports = router;
