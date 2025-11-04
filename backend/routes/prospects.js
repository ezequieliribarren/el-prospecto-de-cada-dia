const express = require('express');
const { listProspects, deleteProspect } = require('../controllers/prospectsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', listProspects);
router.delete('/:id', requireAuth, requireRole('admin'), deleteProspect);

module.exports = router;
