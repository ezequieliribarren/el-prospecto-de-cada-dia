const express = require('express');
const { listSent } = require('../controllers/sentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listSent);

module.exports = router;

