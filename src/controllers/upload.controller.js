// ============================================
// Upload Controller — Handles file uploads
// ============================================
// This file does the heavy lifting for uploads:
//   1. Configures multer (the upload library)
//   2. Validates file types (jpg, png, webp only)
//   3. Checks user's storage quota before saving
//   4. Saves files to user-specific folders
//   5. Updates the user's usedStorage in users.json
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');  // Built into Node.js — no extra package needed
const { readUsers, writeUsers } = require('./auth.controller');

// --- Configuration ---
const STORAGE_BASE = path.join(__dirname, '..', '..', 'storage', 'user-files');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// ============================================
// MULTER CONFIGURATION
// ============================================
// Multer is middleware that handles "multipart/form-data",
// which is the format used when uploading files.
//
// We configure TWO things:
//   1. storage — WHERE and HOW to save files
//   2. fileFilter — WHICH files to accept/reject

// --- Storage configuration ---
// multer.diskStorage() saves files directly to disk.
// We customize the destination (folder) and filename.
const storage = multer.diskStorage({

  // destination — which folder to save the file in.
  // We create a subfolder for each user: storage/user-files/mom/
  destination: (req, file, cb) => {
    const username = req.user.username; // from auth middleware
    const userFolder = path.join(STORAGE_BASE, username);

    // Create user folder if it doesn't exist
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
      console.log(`📁 Created folder for user: ${username}`);
    }

    // cb(error, destinationPath)
    // null = no error, userFolder = save here
    cb(null, userFolder);
  },

  // filename — what to name the saved file.
  // We use a UUID to avoid filename collisions.
  // Example: "a1b2c3d4-photo.jpg"
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID().split('-')[0]; // short unique ID
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${uniqueId}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, safeName);
  }
});

// --- File filter ---
// This function runs BEFORE the file is saved.
// It checks if the file type is allowed.
const fileFilter = (req, file, cb) => {
  // Check MIME type (what the browser says the file is)
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    // cb(error, acceptFile)
    // We create an error and reject the file
    const error = new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error(`File extension not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // File is valid, accept it
  cb(null, true);
};

// --- Create the multer instance ---
// This combines our storage config, file filter, and size limit.
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE // 20MB
  }
});

// ============================================
// UPLOAD HANDLER
// ============================================
// Route: POST /upload
// Headers: Authorization: Bearer <token>
// Body: form-data with key "image" containing the file
//
// Flow:
// 1. Auth middleware verifies JWT → sets req.user
// 2. Multer processes the file upload
// 3. We check the user's quota
// 4. If quota OK → file is already saved by multer
// 5. If quota exceeded → delete the saved file and reject

const uploadImage = async (req, res) => {
  try {
    // --- Check if a file was actually provided ---
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Send a file with key "image".'
      });
    }

    const username = req.user.username;
    const fileSizeInMB = req.file.size / (1024 * 1024); // Convert bytes to MB

    // --- Check quota ---
    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      // Clean up the uploaded file since user not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    const remainingQuota = user.quota - user.usedStorage;

    if (fileSizeInMB > remainingQuota) {
      // Quota exceeded — delete the file that multer already saved
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Storage quota exceeded',
        details: {
          quota: `${user.quota} MB`,
          used: `${user.usedStorage.toFixed(2)} MB`,
          remaining: `${remainingQuota.toFixed(2)} MB`,
          fileSize: `${fileSizeInMB.toFixed(2)} MB`
        }
      });
    }

    // --- Quota OK — update usedStorage ---
    user.usedStorage = parseFloat((user.usedStorage + fileSizeInMB).toFixed(2));
    writeUsers(users);

    console.log(`📸 ${username} uploaded: ${req.file.filename} (${fileSizeInMB.toFixed(2)} MB)`);

    // --- Send success response ---
    return res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: `${fileSizeInMB.toFixed(2)} MB`,
        path: `/storage/${username}/${req.file.filename}`
      },
      storage: {
        used: `${user.usedStorage} MB`,
        quota: `${user.quota} MB`,
        remaining: `${(user.quota - user.usedStorage).toFixed(2)} MB`
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Export both the multer middleware and upload handler
module.exports = { upload, uploadImage };
