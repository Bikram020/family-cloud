// ============================================
// Admin Controller — User & storage management
// ============================================

const bcrypt = require('bcryptjs');
const { readUsers, writeUsers } = require('./auth.controller');
const { deleteUserFolder, recalculateUsage } = require('../services/storage.service');
const { getStorageSummary, syncAllUsage } = require('../services/quota.service');
const { getUserStorageReport } = require('../services/file.service');

// ============================================
// GET /admin/pending-users
// ============================================
// Returns users waiting for admin approval.
const getPendingUsers = async (req, res) => {
  try {
    const users = readUsers();
    const pending = users
      .filter(u => u.status === 'pending')
      .map(u => ({
        username: u.username,
        name: u.name,
        mobile: u.mobile,
        registeredAt: u.registeredAt || 'unknown'
      }));

    return res.status(200).json({
      count: pending.length,
      users: pending
    });
  } catch (error) {
    console.error('❌ Get pending users error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// POST /admin/approve-user
// ============================================
// Body: { username, quota }
// Approves a pending user and assigns their quota.
const approveUser = async (req, res) => {
  try {
    const { username, quota } = req.body;

    if (!username || !quota || quota <= 0) {
      return res.status(400).json({
        error: 'Username and quota (positive number in MB) are required'
      });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username.toLowerCase());

    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }

    if (user.status === 'active') {
      return res.status(400).json({ error: `User "${username}" is already approved` });
    }

    user.status = 'active';
    user.quota = Number(quota);
    writeUsers(users);

    console.log(`✅ Admin approved: ${user.name} (@${username}) — quota: ${quota} MB`);

    return res.status(200).json({
      message: `User "${user.name}" (@${username}) approved!`,
      user: {
        username: user.username,
        name: user.name,
        mobile: user.mobile,
        status: user.status,
        quota: user.quota
      }
    });
  } catch (error) {
    console.error('❌ Approve user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// POST /admin/reject-user
// ============================================
// Body: { username }
// Rejects and removes a pending user.
const rejectUser = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const users = readUsers();
    const idx = users.findIndex(u => u.username === username.toLowerCase() && u.status === 'pending');

    if (idx === -1) {
      return res.status(404).json({ error: `Pending user "${username}" not found` });
    }

    const removed = users.splice(idx, 1)[0];
    writeUsers(users);

    console.log(`❌ Admin rejected: ${removed.name} (@${username})`);

    return res.status(200).json({ message: `User "${removed.name}" rejected and removed` });
  } catch (error) {
    console.error('❌ Reject user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// POST /admin/create-user (direct create, no approval needed)
// ============================================
const createUser = async (req, res) => {
  try {
    const { mobile, username, name, password, quota } = req.body;

    if (!mobile || !username || !name || !password || !quota) {
      return res.status(400).json({
        error: 'All fields required: mobile, username, name, password, quota'
      });
    }

    const users = readUsers();
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanUsername = username.toLowerCase().trim();

    if (users.find(u => u.mobile === cleanMobile)) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }
    if (users.find(u => u.username === cleanUsername)) {
      return res.status(400).json({ error: `Username "${cleanUsername}" already taken` });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      mobile: cleanMobile,
      username: cleanUsername,
      name: name.trim(),
      password: hashedPassword,
      role: 'user',
      status: 'active',
      quota: Number(quota),
      usedStorage: 0
    };

    users.push(newUser);
    writeUsers(users);

    console.log(`👤 Admin created user: ${newUser.name} (@${cleanUsername})`);

    return res.status(201).json({
      message: `User "${newUser.name}" created and activated`,
      user: { username: newUser.username, name: newUser.name, mobile: newUser.mobile, quota: newUser.quota }
    });
  } catch (error) {
    console.error('❌ Create user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// DELETE /admin/user/:username
// ============================================
const deleteUser = async (req, res) => {
  try {
    const { username } = req.params;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.username === username.toLowerCase());

    if (userIndex === -1) return res.status(404).json({ error: `User "${username}" not found` });
    if (username.toLowerCase() === req.user.username) return res.status(400).json({ error: 'Cannot delete yourself' });
    if (users[userIndex].role === 'admin') return res.status(400).json({ error: 'Cannot delete admin accounts' });

    deleteUserFolder(username.toLowerCase());
    const deletedUser = users.splice(userIndex, 1)[0];
    writeUsers(users);

    console.log(`🗑️  Admin deleted: ${deletedUser.name} (@${username})`);
    return res.status(200).json({ message: `User "${deletedUser.name}" deleted`, freedStorage: `${deletedUser.usedStorage} MB` });
  } catch (error) {
    console.error('❌ Delete user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// PATCH /admin/set-quota
// ============================================
const setQuota = async (req, res) => {
  try {
    const { username, quota } = req.body;
    if (!username || quota === undefined || quota <= 0) {
      return res.status(400).json({ error: 'Username and positive quota required' });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username.toLowerCase());
    if (!user) return res.status(404).json({ error: `User "${username}" not found` });

    const oldQuota = user.quota;
    user.quota = Number(quota);
    writeUsers(users);

    console.log(`📊 Quota: ${user.name} ${oldQuota} → ${quota} MB`);
    return res.status(200).json({
      message: `Quota updated for ${user.name}`,
      user: { username: user.username, oldQuota: `${oldQuota} MB`, newQuota: `${user.quota} MB`, remaining: `${(user.quota - user.usedStorage).toFixed(2)} MB` }
    });
  } catch (error) {
    console.error('❌ Set quota error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// GET /admin/users
// ============================================
const getUsers = async (req, res) => {
  try {
    return res.status(200).json(getStorageSummary());
  } catch (error) {
    console.error('❌ Get users error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// POST /admin/sync-storage
// ============================================
const syncStorage = async (req, res) => {
  try {
    const result = syncAllUsage();
    return res.status(200).json({ message: 'Storage synced', ...result });
  } catch (error) {
    console.error('❌ Sync error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// GET /admin/user/:username/files
// ============================================
const getUserFilesAdmin = async (req, res) => {
  try {
    const { username } = req.params;
    const report = getUserStorageReport(username);
    if (!report) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(report);
  } catch (error) {
    console.error('❌ Get user files error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser,
  createUser,
  deleteUser,
  setQuota,
  getUsers,
  syncStorage,
  getUserFilesAdmin
};
