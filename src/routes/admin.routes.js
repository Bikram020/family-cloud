// ============================================
// Admin Routes — Maps admin URLs to controllers
// ============================================
// All routes here require:
//   1. authenticate (valid JWT)
//   2. isAdmin (role === 'admin')
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');
const {
  createUser,
  deleteUser,
  setQuota,
  getUsers,
  syncStorage
} = require('../controllers/admin.controller');

// All admin routes use both middlewares
// authenticate runs first (checks JWT), then isAdmin (checks role)

// POST /admin/create-user — Create a new user
router.post('/create-user', authenticate, isAdmin, createUser);

// DELETE /admin/user/:username — Delete a user and their files
router.delete('/user/:username', authenticate, isAdmin, deleteUser);

// PATCH /admin/set-quota — Change a user's storage quota
router.patch('/set-quota', authenticate, isAdmin, setQuota);

// GET /admin/users — Get all users with storage stats
router.get('/users', authenticate, isAdmin, getUsers);

// POST /admin/sync-storage — Recalculate all storage from disk
router.post('/sync-storage', authenticate, isAdmin, syncStorage);

module.exports = router;
