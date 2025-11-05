const express = require('express');
const { listUploads, deleteUpload, purgeLegacy, updateUpload } = require('../controllers/uploadsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), listUploads);
router.delete('/:id', requireAuth, requireRole('admin'), deleteUpload);
router.put('/:id', requireAuth, requireRole('admin'), updateUpload);
router.delete('/legacy/all', requireAuth, requireRole('admin'), purgeLegacy);

module.exports = router;
