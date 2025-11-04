const express = require('express');
const { me, listUsers, register, login, logout } = require('../controllers/authController');
const { authOptional, requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authOptional, me);
router.get('/users', requireAuth, requireRole('admin'), listUsers);
router.post('/register', authOptional, register); // bootstrap allows first admin; otherwise admin-only inside controller
router.post('/login', login);
router.post('/logout', requireAuth, logout);

module.exports = router;

