// ============================================
// File Service — High-level file operations
// ============================================
// Combines storage and quota services for
// operations that need both file and user data.
// Used by admin endpoints for detailed file views.
// ============================================

const { readUsers, writeUsers } = require('../controllers/auth.controller');
const { getUserFiles, recalculateUsage, STORAGE_BASE } = require('./storage.service');
const fs = require('fs');
const path = require('path');

// --- Get detailed storage report for a specific user ---
// Used by admin to inspect a user's files.
const getUserStorageReport = (username) => {
  const users = readUsers();
  const user = users.find(u => u.username === username.toLowerCase());

  if (!user) return null;

  const files = getUserFiles(username);
  const actualDiskUsage = recalculateUsage(username);

  return {
    username: user.username,
    role: user.role,
    quota: `${user.quota} MB`,
    usedStorage: `${user.usedStorage} MB`,
    actualDiskUsage: `${actualDiskUsage.toFixed(2)} MB`,
    remaining: `${(user.quota - user.usedStorage).toFixed(2)} MB`,
    usagePercent: user.quota > 0
      ? parseFloat(((user.usedStorage / user.quota) * 100).toFixed(1))
      : 0,
    totalFiles: files.length,
    files: files,
    inSync: Math.abs(user.usedStorage - actualDiskUsage) < 0.01
  };
};

// --- Get system-wide storage overview ---
// Shows total phone storage stats alongside user quotas.
const getSystemOverview = () => {
  const users = readUsers();
  const totalQuota = users.reduce((sum, u) => sum + u.quota, 0);
  const totalUsed = users.reduce((sum, u) => sum + u.usedStorage, 0);
  const totalFiles = users.reduce((sum, u) => {
    return sum + getUserFiles(u.username).length;
  }, 0);

  return {
    server: {
      status: 'running',
      uptime: `${(process.uptime() / 3600).toFixed(1)} hours`,
      nodeVersion: process.version,
      platform: process.platform
    },
    storage: {
      totalQuotaAssigned: `${totalQuota} MB`,
      totalUsed: `${totalUsed.toFixed(2)} MB`,
      totalRemaining: `${(totalQuota - totalUsed).toFixed(2)} MB`,
      totalFiles: totalFiles
    },
    users: users.map(u => ({
      username: u.username,
      role: u.role,
      quota: u.quota,
      usedStorage: u.usedStorage,
      fileCount: getUserFiles(u.username).length
    }))
  };
};

module.exports = {
  getUserStorageReport,
  getSystemOverview
};
