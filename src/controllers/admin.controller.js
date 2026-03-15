// ============================================
// Admin Controller — User & storage management
// ============================================

const bcrypt = require('bcryptjs');
const { readUsers, writeUsers } = require('./auth.controller');
const { deleteUserFolder, recalculateUsage } = require('../services/storage.service');
const { getStorageSummary, syncAllUsage, getQuotaCapacitySnapshot } = require('../services/quota.service');
const { getUserStorageReport } = require('../services/file.service');

// GET /admin/pending-users
const getPendingUsers = async (req, res) => {
  try {
    const users = readUsers();
    const pending = users
      .filter(u => u.status === 'pending')
      .map(u => ({ username: u.username, name: u.name, mobile: u.mobile, registeredAt: u.registeredAt || 'unknown' }));
    return res.status(200).json({ count: pending.length, users: pending });
  } catch (error) {
    console.error('❌ Get pending users error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/approve-user { username, quota }
const approveUser = async (req, res) => {
  try {
    const { username, quota } = req.body;
    if (!username || !quota || quota <= 0) {
      return res.status(400).json({ error: 'Username and quota (positive number in MB) are required' });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username.toLowerCase());
    if (!user) return res.status(404).json({ error: `User "${username}" not found` });
    if (user.status === 'active') return res.status(400).json({ error: `User "${username}" is already approved` });

    // Check unallocated space
    const { unallocated } = getQuotaCapacitySnapshot(users);
    if (Number(quota) > unallocated) {
      return res.status(400).json({ error: `Not enough unallocated space. Available: ${unallocated} MB, Requested: ${quota} MB` });
    }

    user.status = 'active';
    user.quota = Number(quota);
    writeUsers(users);

    console.log(`✅ Admin approved: ${user.name} (@${username}) — quota: ${quota} MB`);
    return res.status(200).json({
      message: `User "${user.name}" (@${username}) approved!`,
      user: { username: user.username, name: user.name, mobile: user.mobile, status: user.status, quota: user.quota }
    });
  } catch (error) {
    console.error('❌ Approve user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/reject-user { username }
const rejectUser = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = readUsers();
    const idx = users.findIndex(u => u.username === username.toLowerCase() && u.status === 'pending');
    if (idx === -1) return res.status(404).json({ error: `Pending user "${username}" not found` });
    const removed = users.splice(idx, 1)[0];
    writeUsers(users);
    console.log(`❌ Admin rejected: ${removed.name} (@${username})`);
    return res.status(200).json({ message: `User "${removed.name}" rejected and removed` });
  } catch (error) {
    console.error('❌ Reject user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /admin/user/:username
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
    return res.status(200).json({ message: `User "${deletedUser.name}" deleted`, freedQuota: `${deletedUser.quota} MB` });
  } catch (error) {
    console.error('❌ Delete user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /admin/set-quota { username, quota }
const setQuota = async (req, res) => {
  try {
    const { username, quota } = req.body;
    if (!username || quota === undefined || quota <= 0) {
      return res.status(400).json({ error: 'Username and positive quota required' });
    }
    const users = readUsers();
    const user = users.find(u => u.username === username.toLowerCase());
    if (!user) return res.status(404).json({ error: `User "${username}" not found` });

    const newQuota = Number(quota);
    const quotaDiff = newQuota - user.quota;
    if (quotaDiff > 0) {
      const { unallocated } = getQuotaCapacitySnapshot(users);
      if (quotaDiff > unallocated) {
        return res.status(400).json({ error: `Not enough unallocated space. Available: ${unallocated} MB, Need: ${quotaDiff} MB` });
      }
    }
    if (newQuota < user.usedStorage) {
      return res.status(400).json({ error: `Can't set quota below used storage (${user.usedStorage} MB)` });
    }

    const oldQuota = user.quota;
    user.quota = newQuota;
    writeUsers(users);

    console.log(`📊 Quota: ${user.name} ${oldQuota} → ${newQuota} MB`);
    return res.status(200).json({
      message: `Quota updated for ${user.name}`,
      user: { username: user.username, oldQuota, newQuota: user.quota, used: user.usedStorage }
    });
  } catch (error) {
    console.error('❌ Set quota error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /admin/reallocate { fromUser, toUser, amount }
const reallocateStorage = async (req, res) => {
  try {
    const { fromUser, toUser, amount } = req.body;
    if (!toUser || !amount || amount <= 0) {
      return res.status(400).json({ error: 'toUser and amount (positive MB) required' });
    }

    const users = readUsers();
    const to = users.find(u => u.username === toUser.toLowerCase());
    if (!to) return res.status(404).json({ error: `User "${toUser}" not found` });

    const amountMB = Number(amount);

    if (fromUser && fromUser !== 'unallocated') {
      const from = users.find(u => u.username === fromUser.toLowerCase());
      if (!from) return res.status(404).json({ error: `User "${fromUser}" not found` });

      const fromAvailable = from.quota - from.usedStorage;
      if (amountMB > fromAvailable) {
        return res.status(400).json({ error: `${from.name} only has ${fromAvailable} MB free to reallocate` });
      }

      from.quota -= amountMB;
      to.quota += amountMB;
      writeUsers(users);

      console.log(`🔄 Reallocated: ${amountMB} MB from ${from.name} → ${to.name}`);
      return res.status(200).json({
        message: `Moved ${amountMB} MB from ${from.name} to ${to.name}`,
        from: { username: from.username, quota: from.quota },
        to: { username: to.username, quota: to.quota }
      });
    } else {
      const { unallocated } = getQuotaCapacitySnapshot(users);

      if (amountMB > unallocated) {
        return res.status(400).json({ error: `Not enough unallocated space. Available: ${unallocated} MB` });
      }

      to.quota += amountMB;
      writeUsers(users);

      console.log(`📦 Allocated: ${amountMB} MB from pool → ${to.name}`);
      return res.status(200).json({
        message: `Allocated ${amountMB} MB to ${to.name} from unallocated pool`,
        to: { username: to.username, quota: to.quota },
        remainingUnallocated: parseFloat((unallocated - amountMB).toFixed(2))
      });
    }
  } catch (error) {
    console.error('❌ Reallocate error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/users
const getUsers = async (req, res) => {
  try { return res.status(200).json(getStorageSummary()); }
  catch (error) { return res.status(500).json({ error: 'Internal server error' }); }
};

// POST /admin/sync-storage
const syncStorage = async (req, res) => {
  try { return res.status(200).json({ message: 'Storage synced', ...syncAllUsage() }); }
  catch (error) { return res.status(500).json({ error: 'Internal server error' }); }
};

// GET /admin/user/:username/files
const getUserFilesAdmin = async (req, res) => {
  try {
    const { username } = req.params;
    const report = getUserStorageReport(username);
    if (!report) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPendingUsers, approveUser, rejectUser, deleteUser, setQuota,
  reallocateStorage, getUsers, syncStorage, getUserFilesAdmin
};
