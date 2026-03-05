// ============================================
// Gallery Controller — View images + delete files
// ============================================
// Handles two things:
//   1. GET /gallery — list all images for the logged-in user
//   2. DELETE /file/:filename — delete a specific image
//
// Both endpoints use req.user (set by auth middleware)
// to ensure users can only see/delete their OWN files.
// Admins can view/delete any user's files using ?user=username
// ============================================

const { readUsers, writeUsers } = require('./auth.controller');
const { getUserFiles, deleteFile } = require('../services/storage.service');

// ============================================
// GET /gallery
// ============================================
// Returns an array of the logged-in user's images.
// Admin can pass ?user=mom to view another user's gallery.
//
// Response format (designed for frontend):
// {
//   username: "mom",
//   totalFiles: 5,
//   storage: { used: "3.5 MB", quota: "20000 MB", remaining: "19996.5 MB" },
//   files: [
//     { filename: "abc123-photo.jpg", size: "1.2 MB", url: "/files/mom/abc123-photo.jpg", uploadedAt: "..." },
//     ...
//   ]
// }
const getGallery = async (req, res) => {
  try {
    // Determine which user's gallery to show
    let targetUsername = req.user.username;

    // Admin can view another user's gallery: GET /gallery?user=mom
    if (req.query.user && req.user.role === 'admin') {
      targetUsername = req.query.user.toLowerCase();
    }

    // Get user info for storage stats
    const users = readUsers();
    const user = users.find(u => u.username === targetUsername);

    if (!user) {
      return res.status(404).json({ error: `User "${targetUsername}" not found` });
    }

    // Get the list of files from disk
    const files = getUserFiles(targetUsername);

    return res.status(200).json({
      username: targetUsername,
      totalFiles: files.length,
      storage: {
        used: `${user.usedStorage} MB`,
        quota: `${user.quota} MB`,
        remaining: `${(user.quota - user.usedStorage).toFixed(2)} MB`,
        usagePercent: user.quota > 0
          ? parseFloat(((user.usedStorage / user.quota) * 100).toFixed(1))
          : 0
      },
      files: files
    });

  } catch (error) {
    console.error('❌ Gallery error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// DELETE /file/:filename
// ============================================
// Deletes a specific file belonging to the logged-in user.
// Admin can pass ?user=mom to delete another user's file.
//
// The filename comes from the URL:
//   DELETE /file/abc123-photo.jpg
//
// After deletion, the user's usedStorage is updated.
const deleteFileHandler = async (req, res) => {
  try {
    const { filename } = req.params;

    // Determine whose file to delete
    let targetUsername = req.user.username;

    if (req.query.user && req.user.role === 'admin') {
      targetUsername = req.query.user.toLowerCase();
    }

    // Attempt to delete the file
    const result = deleteFile(targetUsername, filename);

    if (!result.success) {
      return res.status(404).json({
        error: result.error,
        hint: `File "${filename}" not found in ${targetUsername}'s storage`
      });
    }

    // Update the user's usedStorage in users.json
    const users = readUsers();
    const user = users.find(u => u.username === targetUsername);

    if (user) {
      user.usedStorage = parseFloat(
        Math.max(0, user.usedStorage - result.freedMB).toFixed(2)
      );
      writeUsers(users);
    }

    console.log(`🗑️  ${targetUsername} deleted: ${filename} (freed ${result.freedMB.toFixed(2)} MB)`);

    return res.status(200).json({
      message: `File "${filename}" deleted successfully`,
      freed: `${result.freedMB.toFixed(2)} MB`,
      storage: user ? {
        used: `${user.usedStorage} MB`,
        quota: `${user.quota} MB`,
        remaining: `${(user.quota - user.usedStorage).toFixed(2)} MB`
      } : null
    });

  } catch (error) {
    console.error('❌ Delete file error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getGallery, deleteFileHandler };
