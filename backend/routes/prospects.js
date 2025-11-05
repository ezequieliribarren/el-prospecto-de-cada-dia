const express = require('express');
const { listProspects, deleteProspect, updateProspect } = require('../controllers/prospectsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', listProspects);
router.delete('/:id', requireAuth, requireRole('admin'), deleteProspect);
router.put('/:id', requireAuth, requireRole('admin'), updateProspect);

module.exports = router;
