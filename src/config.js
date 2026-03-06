// ============================================
// Shared Config — Central configuration
// ============================================
// Storage path for uploaded files.
// Using shared storage so photos appear in the phone's gallery app.
// After running `termux-setup-storage`, ~/storage/shared maps to /sdcard/
// Each user gets their own album folder (e.g., FamilyCloud/dad/, FamilyCloud/mom/)
// ============================================

const path = require('path');
const os = require('os');

// Detect if running in Termux (Android)
const isTermux = os.platform() === 'android' || process.env.TERMUX_VERSION;

// Use shared storage on Android (visible in phone gallery), fallback to project dir
const STORAGE_BASE = isTermux
  ? path.join(os.homedir(), 'storage', 'shared', 'Pictures', 'FamilyCloud')
  : path.join(__dirname, '..', 'storage', 'user-files');

module.exports = { STORAGE_BASE };
