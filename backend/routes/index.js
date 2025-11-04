const express = require('express');
const router = express.Router();

const uploadRoutes = require('./upload');
const planRoutes = require('./plan');
const prospectsRoutes = require('./prospects');
const metricsRoutes = require('./metrics');
const settingsRoutes = require('./settings');
const workRoutes = require('./work');
const authRoutes = require('./auth');
const uploadsRoutes = require('./uploads');
const sentRoutes = require('./sent');
const { requireAuth, requireRole, authOptional } = require('../middleware/auth');

router.use('/auth', authRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/sent', sentRoutes);
router.use('/upload', requireAuth, requireRole('admin'), uploadRoutes);
router.use('/plan', requireAuth, planRoutes);
router.use('/prospects', requireAuth, requireRole('admin'), prospectsRoutes);
router.use('/metrics', requireAuth, metricsRoutes);
router.use('/settings', requireAuth, requireRole('admin'), settingsRoutes);
router.use('/work', requireAuth, workRoutes);

module.exports = router;
