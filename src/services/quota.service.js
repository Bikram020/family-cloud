// ============================================
// Quota Service — Storage quota management
// ============================================

const { readUsers, writeUsers } = require('../controllers/auth.controller');
const { recalculateUsage } = require('./storage.service');
const { TOTAL_STORAGE_POOL } = require('../config');
const fs = require('fs');

// --- Read live filesystem free space where uploads are stored ---
// Uses fs.statfsSync when available and falls back to static config if unavailable.
const getDeviceFreeSpaceMB = () => {
  try {
    if (typeof fs.statfsSync !== 'function') {
      return null;
    }

    const stat = fs.statfsSync(process.env.FAMILY_CLOUD_STORAGE_PATH || require('../config').STORAGE_BASE);
    const freeBytes = Number(stat.bavail || stat.bfree || 0) * Number(stat.bsize || 0);
    if (!Number.isFinite(freeBytes) || freeBytes < 0) {
      return null;
    }

    return parseFloat((freeBytes / (1024 * 1024)).toFixed(2));
  } catch {
    return null;
  }
};

// --- Build a capacity snapshot used by admin checks + dashboard ---
const getQuotaCapacitySnapshot = (usersInput = null) => {
  const users = usersInput || readUsers();
  const regularUsers = users.filter(u => u.role !== 'admin');

  const totalAllocated = regularUsers.reduce((sum, u) => sum + u.quota, 0);
  const totalUsed = regularUsers.reduce((sum, u) => sum + u.usedStorage, 0);

  const deviceFreeMB = getDeviceFreeSpaceMB();
  const totalStoragePool = deviceFreeMB !== null
    ? parseFloat((deviceFreeMB + totalUsed).toFixed(2))
    : TOTAL_STORAGE_POOL;

  const unallocated = parseFloat((totalStoragePool - totalAllocated).toFixed(2));

  return {
    totalAllocated: parseFloat(totalAllocated.toFixed(2)),
    totalUsed: parseFloat(totalUsed.toFixed(2)),
    totalStoragePool,
    unallocated,
    deviceFreeMB,
    capacitySource: deviceFreeMB !== null ? 'device-live' : 'config-fallback'
  };
};

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

  const capacity = getQuotaCapacitySnapshot(users);

  return {
    totalStoragePool: capacity.totalStoragePool,
    totalAllocated: capacity.totalAllocated,
    totalUsed: capacity.totalUsed,
    unallocated: capacity.unallocated,
    deviceFreeMB: capacity.deviceFreeMB,
    capacitySource: capacity.capacitySource,
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

module.exports = { hasEnoughQuota, getStorageSummary, syncAllUsage, getQuotaCapacitySnapshot };
