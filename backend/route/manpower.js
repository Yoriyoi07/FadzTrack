const express = require('express');
const router = express.Router();
const { getAllManpower, createManpower, uploadManpowerFromCSV , getUnassignedManpower, updateManpower, reconcileAssignments, getManpowerTypes} = require('../controllers/manpowerController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', getAllManpower);
router.get('/unassigned', getUnassignedManpower); 
router.post('/', verifyToken, createManpower);
router.post('/bulk', uploadManpowerFromCSV);  
router.put('/:id', verifyToken, updateManpower);
router.post('/reconcile', verifyToken, reconcileAssignments);
router.get('/types/list', getManpowerTypes); // autocomplete types

module.exports = router;
