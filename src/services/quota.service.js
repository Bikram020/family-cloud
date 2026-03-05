// ============================================
// Quota Service — Storage quota management
// ============================================
// Handles all quota-related logic:
// - Checking if a user has enough space
// - Getting storage summary for admin dashboard
// - Recalculating quotas from actual disk usage
// ============================================

const { readUsers, writeUsers } = require('../controllers/auth.controller');
const { recalculateUsage } = require('./storage.service');

// --- Check if user has enough quota for a file ---
const hasEnoughQuota = (username, fileSizeMB) => {
  const users = readUsers();
  const user = users.find(u => u.username === username);

  if (!user) return { allowed: false, error: 'User not found' };

  const remaining = user.quota - user.usedStorage;

  return {
    allowed: fileSizeMB <= remaining,
    quota: user.quota,
    used: user.usedStorage,
    remaining: remaining,
    fileSize: fileSizeMB
  };
};

// --- Get storage summary for all users (admin dashboard) ---
// Returns overview data that the frontend can display in charts/tables.
const getStorageSummary = () => {
  const users = readUsers();

  const userStats = users.map(user => ({
    username: user.username,
    role: user.role,
    quota: user.quota,
    usedStorage: user.usedStorage,
    remainingStorage: parseFloat((user.quota - user.usedStorage).toFixed(2)),
    usagePercent: user.quota > 0
      ? parseFloat(((user.usedStorage / user.quota) * 100).toFixed(1))
      : 0
  }));

  const totalQuotaAssigned = users.reduce((sum, u) => sum + u.quota, 0);
  const totalUsed = users.reduce((sum, u) => sum + u.usedStorage, 0);

  return {
    totalUsers: users.length,
    totalQuotaAssigned: `${totalQuotaAssigned} MB`,
    totalUsed: `${totalUsed.toFixed(2)} MB`,
    totalFree: `${(totalQuotaAssigned - totalUsed).toFixed(2)} MB`,
    users: userStats
  };
};

// --- Sync usedStorage with actual disk usage ---
// Recalculates from actual files on disk and updates users.json.
// Useful if the JSON gets out of sync (e.g., manual file deletion).
const syncAllUsage = () => {
  const users = readUsers();
  const changes = [];

  for (const user of users) {
    const actualUsage = recalculateUsage(user.username);
    const oldUsage = user.usedStorage;

    if (Math.abs(actualUsage - oldUsage) > 0.01) { // only update if different
      user.usedStorage = parseFloat(actualUsage.toFixed(2));
      changes.push({
        username: user.username,
        oldUsage: `${oldUsage.toFixed(2)} MB`,
        newUsage: `${user.usedStorage} MB`
      });
    }
  }

  if (changes.length > 0) {
    writeUsers(users);
  }

  return { synced: changes.length, changes };
};

module.exports = {
  hasEnoughQuota,
  getStorageSummary,
  syncAllUsage
};
