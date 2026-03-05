// ============================================
// Admin Controller — User & storage management
// ============================================
// Admin-only endpoints for managing users,
// quotas, and storage. All these routes require
// both authenticate + isAdmin middleware.
// ============================================

const bcrypt = require('bcryptjs');
const { readUsers, writeUsers } = require('./auth.controller');
const { deleteUserFolder, recalculateUsage } = require('../services/storage.service');
const { getStorageSummary, syncAllUsage } = require('../services/quota.service');

// ============================================
// POST /admin/create-user
// ============================================
// Body: { username, password, quota }
// Creates a new user with the given quota (in MB).
const createUser = async (req, res) => {
  try {
    const { username, password, quota } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required'
      });
    }

    if (!quota || quota <= 0) {
      return res.status(400).json({
        error: 'Quota must be a positive number (in MB)'
      });
    }

    // Check if username already exists
    const users = readUsers();
    const existing = users.find(u => u.username === username.toLowerCase());

    if (existing) {
      return res.status(400).json({
        error: `User "${username}" already exists`
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user object
    const newUser = {
      username: username.toLowerCase(),
      password: hashedPassword,
      role: 'user',        // new users are always "user", not "admin"
      quota: Number(quota),
      usedStorage: 0
    };

    users.push(newUser);
    writeUsers(users);

    console.log(`👤 Admin created user: ${newUser.username} (quota: ${quota} MB)`);

    return res.status(201).json({
      message: `User "${newUser.username}" created successfully`,
      user: {
        username: newUser.username,
        role: newUser.role,
        quota: newUser.quota,
        usedStorage: newUser.usedStorage
      }
    });

  } catch (error) {
    console.error('❌ Create user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// DELETE /admin/user/:username
// ============================================
// Deletes a user and ALL their files.
const deleteUser = async (req, res) => {
  try {
    const { username } = req.params;

    const users = readUsers();
    const userIndex = users.findIndex(u => u.username === username.toLowerCase());

    if (userIndex === -1) {
      return res.status(404).json({
        error: `User "${username}" not found`
      });
    }

    // Prevent deleting yourself
    if (username.toLowerCase() === req.user.username) {
      return res.status(400).json({
        error: 'Cannot delete your own account'
      });
    }

    // Prevent deleting other admins
    if (users[userIndex].role === 'admin') {
      return res.status(400).json({
        error: 'Cannot delete admin accounts'
      });
    }

    // Delete user's files from disk
    deleteUserFolder(username.toLowerCase());

    // Remove user from users.json
    const deletedUser = users.splice(userIndex, 1)[0];
    writeUsers(users);

    console.log(`🗑️  Admin deleted user: ${username}`);

    return res.status(200).json({
      message: `User "${username}" and all their files have been deleted`,
      freedStorage: `${deletedUser.usedStorage} MB`
    });

  } catch (error) {
    console.error('❌ Delete user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// PATCH /admin/set-quota
// ============================================
// Body: { username, quota }
// Sets a user's storage quota (in MB).
const setQuota = async (req, res) => {
  try {
    const { username, quota } = req.body;

    if (!username || quota === undefined) {
      return res.status(400).json({
        error: 'Username and quota are required'
      });
    }

    if (quota <= 0) {
      return res.status(400).json({
        error: 'Quota must be a positive number (in MB)'
      });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username.toLowerCase());

    if (!user) {
      return res.status(404).json({
        error: `User "${username}" not found`
      });
    }

    const oldQuota = user.quota;
    user.quota = Number(quota);
    writeUsers(users);

    console.log(`📊 Admin changed quota for ${username}: ${oldQuota} MB → ${quota} MB`);

    return res.status(200).json({
      message: `Quota updated for "${username}"`,
      user: {
        username: user.username,
        oldQuota: `${oldQuota} MB`,
        newQuota: `${user.quota} MB`,
        usedStorage: `${user.usedStorage} MB`,
        remaining: `${(user.quota - user.usedStorage).toFixed(2)} MB`
      }
    });

  } catch (error) {
    console.error('❌ Set quota error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// GET /admin/users
// ============================================
// Returns all users with their storage stats.
// Designed for the admin dashboard frontend.
const getUsers = async (req, res) => {
  try {
    const summary = getStorageSummary();

    return res.status(200).json(summary);

  } catch (error) {
    console.error('❌ Get users error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// POST /admin/sync-storage
// ============================================
// Recalculates all users' usedStorage from actual
// files on disk. Fixes any out-of-sync issues.
const syncStorage = async (req, res) => {
  try {
    const result = syncAllUsage();

    return res.status(200).json({
      message: 'Storage usage synced with disk',
      ...result
    });

  } catch (error) {
    console.error('❌ Sync storage error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createUser,
  deleteUser,
  setQuota,
  getUsers,
  syncStorage
};
