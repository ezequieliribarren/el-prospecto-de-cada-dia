const express = require('express');
const { me, listUsers, register, login, logout, updateUser } = require('../controllers/authController');
const { authOptional, requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authOptional, me);
router.get('/users', requireAuth, requireRole('admin'), listUsers);
router.put('/users/:id', requireAuth, requireRole('admin'), updateUser);
// Also accept POST for updates, per UI flow
router.post('/users/:id', requireAuth, requireRole('admin'), updateUser);
router.post('/register', authOptional, register); // bootstrap allows first admin; otherwise admin-only inside controller
router.post('/login', login);
router.post('/logout', requireAuth, logout);

module.exports = router;
