// ============================================
// Admin Routes
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');
const {
  getPendingUsers, approveUser, rejectUser, deleteUser,
  setQuota, reallocateStorage, getUsers, syncStorage, getUserFilesAdmin
} = require('../controllers/admin.controller');

router.get('/pending-users', authenticate, isAdmin, getPendingUsers);
router.post('/approve-user', authenticate, isAdmin, approveUser);
router.post('/reject-user', authenticate, isAdmin, rejectUser);
router.delete('/user/:username', authenticate, isAdmin, deleteUser);
router.patch('/set-quota', authenticate, isAdmin, setQuota);
router.patch('/reallocate', authenticate, isAdmin, reallocateStorage);
router.get('/users', authenticate, isAdmin, getUsers);
router.post('/sync-storage', authenticate, isAdmin, syncStorage);
router.get('/user/:username/files', authenticate, isAdmin, getUserFilesAdmin);

module.exports = router;
