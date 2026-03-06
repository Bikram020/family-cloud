// ============================================
// Auth Routes
// ============================================

const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/auth.controller');

// POST /auth/register — Sign up (pending admin approval)
router.post('/register', register);

// POST /auth/login — Login with mobile number + password
router.post('/login', login);

module.exports = router;
