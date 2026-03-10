// ============================================
// Quota Service — Storage quota management
// ============================================

const { readUsers, writeUsers } = require('../controllers/auth.controller');
const { recalculateUsage } = require('./storage.service');
const { TOTAL_STORAGE_POOL } = require('../config');

// --- Check if user has enough quota for a file ---
const hasEnoughQuota = (username, fileSizeMB) => {
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return { allowed: false, error: 'User not found' };
  const remaining = user.quota - user.usedStorage;
  return { allowed: fileSizeMB <= remaining, quota: user.quota, used: user.usedStorage, remaining, fileSize: fileSizeMB };
};

// --- Get storage summary for admin dashboard ---
const getStorageSummary = () => {
  const users = readUsers();

  const userStats = users
    .filter(u => u.role !== 'admin') // exclude admin from user list
    .map(user => ({
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      quota: user.quota,
      usedStorage: user.usedStorage,
      remainingStorage: parseFloat((user.quota - user.usedStorage).toFixed(2)),
      usagePercent: user.quota > 0
        ? parseFloat(((user.usedStorage / user.quota) * 100).toFixed(1))
        : 0
    }));

  const totalAllocated = users.filter(u => u.role !== 'admin').reduce((sum, u) => sum + u.quota, 0);
  const totalUsed = users.filter(u => u.role !== 'admin').reduce((sum, u) => sum + u.usedStorage, 0);
  const unallocated = TOTAL_STORAGE_POOL - totalAllocated;

  return {
    totalStoragePool: TOTAL_STORAGE_POOL,
    totalAllocated,
    totalUsed: parseFloat(totalUsed.toFixed(2)),
    unallocated: parseFloat(unallocated.toFixed(2)),
    totalUsers: userStats.length,
    users: userStats
  };
};

// --- Sync usedStorage with actual disk usage ---
const syncAllUsage = () => {
  const users = readUsers();
  const changes = [];
  for (const user of users) {
    if (user.role === 'admin') continue;
    const actualUsage = recalculateUsage(user.username);
    const oldUsage = user.usedStorage;
    if (Math.abs(actualUsage - oldUsage) > 0.01) {
      user.usedStorage = parseFloat(actualUsage.toFixed(2));
      changes.push({ username: user.username, oldUsage: `${oldUsage.toFixed(2)} MB`, newUsage: `${user.usedStorage} MB` });
    }
  }
  if (changes.length > 0) writeUsers(users);
  return { synced: changes.length, changes };
};

module.exports = { hasEnoughQuota, getStorageSummary, syncAllUsage };
