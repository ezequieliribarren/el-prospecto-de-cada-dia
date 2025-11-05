const express = require('express');
const { startWork, stopWork, statusWork } = require('../controllers/workController');

const router = express.Router();

router.post('/start', startWork);
router.post('/stop', stopWork);
router.get('/status', statusWork);

module.exports = router;
