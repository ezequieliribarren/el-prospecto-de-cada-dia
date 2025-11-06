const express = require('express');
const { generatePlan, getDayPlan, getWeekPlan, getRangePlan, autoGenerate, updatePlanStatus, markPlanProspectUnwanted } = require('../controllers/planController');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/generate', requireRole('admin'), generatePlan);
router.get('/day', getDayPlan);
router.get('/week', getWeekPlan);
router.get('/range', getRangePlan);
router.post('/auto', requireRole('admin'), autoGenerate);
router.put('/:id/status', updatePlanStatus);
router.put('/:id/unwanted', markPlanProspectUnwanted);

module.exports = router;
