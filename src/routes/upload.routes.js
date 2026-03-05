// ============================================
// Upload Routes — Defines the upload URL path
// ============================================
// POST /upload — Upload an image (requires login)
//
// This route uses TWO middleware before the controller:
//   1. authenticate — verifies JWT token
//   2. upload.single('image') — processes the file upload
//
// The "image" in upload.single('image') means the client
// must send the file with the form field name "image".
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { upload, uploadImage } = require('../controllers/upload.controller');

// --- Error handling wrapper for multer ---
// Multer throws specific errors (file too large, invalid type).
// We catch these and send proper JSON error responses
// instead of letting Express show an ugly HTML error page.
const handleUpload = (req, res, next) => {
  // upload.single('image') processes ONE file with field name "image"
  upload.single('image')(req, res, (err) => {
    if (err) {
      // --- Multer-specific errors ---
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large. Maximum size is 20MB.'
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          error: err.message
        });
      }
      // --- Generic multer error ---
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          error: `Upload error: ${err.message}`
        });
      }
      // --- Unknown error ---
      return res.status(500).json({
        error: 'Something went wrong during upload'
      });
    }
    // No error — continue to the upload controller
    next();
  });
};

const multer = require('multer');

// POST /upload
// Chain: authenticate → handleUpload (multer) → uploadImage (controller)
router.post('/', authenticate, handleUpload, uploadImage);

module.exports = router;
