const express = require('express');
const { listSent, updateProspectWhatsApp } = require('../controllers/sentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listSent);
router.put('/prospect/:id/whatsapp', requireAuth, updateProspectWhatsApp);

module.exports = router;
