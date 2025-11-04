const express = require('express');
const { startWork, stopWork } = require('../controllers/workController');

const router = express.Router();

router.post('/start', startWork);
router.post('/stop', stopWork);

module.exports = router;

