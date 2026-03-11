// ============================================
// Storage Service — File system operations
// ============================================
// Handles reading, calculating sizes, and managing
// actual files on disk. Used by admin and gallery.
// ============================================

const fs = require('fs');
const path = require('path');

const { STORAGE_BASE } = require('../config');
const { deleteThumbnail, deleteUserThumbnailFolder } = require('./thumbnail.service');

// --- Get the size of a directory in MB ---
// Recursively walks through all files and sums their sizes.
const getDirectorySizeMB = (dirPath) => {
  if (!fs.existsSync(dirPath)) return 0;

  let totalSize = 0;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      totalSize += stat.size;
    } else if (stat.isDirectory()) {
      totalSize += getDirectorySizeMB(filePath) * 1024 * 1024; // convert back to bytes
    }
  }

  return totalSize / (1024 * 1024); // Convert bytes to MB
};

// --- Get list of files for a user ---
// Returns an array of file objects with name, size, and upload date.
const getUserFiles = (username) => {
  const userFolder = path.join(STORAGE_BASE, username);

  if (!fs.existsSync(userFolder)) return [];

  const files = fs.readdirSync(userFolder);

  return files
    .filter(f => f !== '.gitkeep') // ignore git placeholder files
    .map(filename => {
      const filePath = path.join(userFolder, filename);
      const stat = fs.statSync(filePath);

      return {
        filename: filename,
        size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
        sizeBytes: stat.size,
        uploadedAt: stat.birthtime.toISOString(),
        // URL that the frontend can use to display the image
        url: `/files/${username}/${filename}`,
        thumbnailUrl: `/thumbs/${username}/${filename}`
      };
    })
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)); // newest first
};

// --- Delete a user's file ---
const deleteFile = (username, filename) => {
  const filePath = path.join(STORAGE_BASE, username, filename);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }

  const stat = fs.statSync(filePath);
  const fileSizeMB = stat.size / (1024 * 1024);

  fs.unlinkSync(filePath);
  deleteThumbnail(username, filename);

  return { success: true, freedMB: fileSizeMB };
};

// --- Delete all files for a user ---
const deleteUserFolder = (username) => {
  const userFolder = path.join(STORAGE_BASE, username);

  if (fs.existsSync(userFolder)) {
    fs.rmSync(userFolder, { recursive: true, force: true });
  }

  deleteUserThumbnailFolder(username);
};

// --- Recalculate actual disk usage for a user ---
// Useful if usedStorage in users.json gets out of sync.
const recalculateUsage = (username) => {
  const userFolder = path.join(STORAGE_BASE, username);
  return getDirectorySizeMB(userFolder);
};

module.exports = {
  STORAGE_BASE,
  getDirectorySizeMB,
  getUserFiles,
  deleteFile,
  deleteUserFolder,
  recalculateUsage
};
