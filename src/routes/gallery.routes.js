// ============================================
// Gallery Routes — View images + delete files
// ============================================
// Both routes require authentication (JWT).
// Users can only access their own files.
// Admins can access anyone's files using ?user=username
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getGallery, deleteFileHandler } = require('../controllers/gallery.controller');

// GET /gallery — View your images (admin: ?user=mom)
router.get('/', authenticate, getGallery);

// DELETE /file/:filename — Delete a specific image
router.delete('/:filename', authenticate, deleteFileHandler);

module.exports = router;
