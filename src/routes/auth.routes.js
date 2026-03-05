// ============================================
// Auth Routes — Defines the login URL path
// ============================================
// This file ONLY defines which URL maps to which
// controller function. It does NOT contain logic.
//
// Think of it like a receptionist:
//   "Oh, you want /auth/login? Let me send you to the login handler."
// ============================================

const express = require('express');
const router = express.Router();
const { login } = require('../controllers/auth.controller');

// POST /auth/login
// When someone sends a POST request to /auth/login,
// call the login() function from auth.controller.js
router.post('/login', login);

// Export the router so server.js can use it
module.exports = router;
