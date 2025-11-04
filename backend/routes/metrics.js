const express = require('express');
const { getMetrics } = require('../controllers/metricsController');

const router = express.Router();

router.get('/', getMetrics);

module.exports = router;

