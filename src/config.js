// ============================================
// Shared Config — Central configuration
// ============================================

const path = require('path');
const os = require('os');

// Detect if running in Termux (Android)
const isTermux = os.platform() === 'android' || process.env.TERMUX_VERSION;

// Use shared storage on Android (visible in phone gallery), fallback to project dir
const STORAGE_BASE = isTermux
  ? path.join(os.homedir(), 'storage', 'shared', 'Pictures', 'FamilyCloud')
  : path.join(__dirname, '..', 'storage', 'user-files');

// Thumbnails are stored in a hidden folder so they don't appear in gallery apps.
const THUMBNAIL_BASE = path.join(STORAGE_BASE, '.thumbnails');
const THUMB_MAX_WIDTH = 360;
const THUMB_QUALITY = 70;

// Total storage pool in MB (adjust based on your S10's available storage)
// This is the maximum amount ALL users can share.
// Unallocated = TOTAL_STORAGE_POOL - sum of all user quotas
const TOTAL_STORAGE_POOL = 30000; // 30 GB

module.exports = {
  STORAGE_BASE,
  THUMBNAIL_BASE,
  THUMB_MAX_WIDTH,
  THUMB_QUALITY,
  TOTAL_STORAGE_POOL
};
