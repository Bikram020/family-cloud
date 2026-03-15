// ============================================
// Family Cloud Storage Server — Entry Point
// ============================================
// This is the main file that starts everything.
// It creates an Express app, sets up middleware,
// connects all the routes, and starts listening.
// ============================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Keep visibility on unexpected exits and prevent accidental hangup shutdowns
// in terminal environments where SIGHUP can be sent after command execution.
process.on('SIGHUP', () => {
  console.warn('⚠️ Received SIGHUP, keeping server alive');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

// --- Create the Express app ---
const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3000;

// --- Built-in Middleware ---
// These run on EVERY request before your route handlers.

// CORS — allows the frontend to make API requests
app.use(cors());

// Request Logger — logs every request for monitoring
const { logger } = require('./middleware/logger.middleware');
app.use(logger);

// Parse JSON request bodies
app.use(express.json());

// Parse form-encoded data
app.use(express.urlencoded({ extended: true }));

// --- Ensure storage directory exists ---
const { STORAGE_BASE, THUMBNAIL_BASE } = require('./config');
const storagePath = STORAGE_BASE;
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
  console.log('📁 Created storage directory:', storagePath);
}

if (!fs.existsSync(THUMBNAIL_BASE)) {
  fs.mkdirSync(THUMBNAIL_BASE, { recursive: true });
  console.log('🖼️ Created thumbnail directory:', THUMBNAIL_BASE);
}

// --- Ensure data directory exists ---
const dataPath = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

// Ensure users.json exists
const usersFile = path.join(dataPath, 'users.json');
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]', 'utf-8');
  console.log('📄 Created empty users.json');
}

// ============================================
// ROUTES
// ============================================
const authRoutes = require('./routes/auth.routes');
const uploadRoutes = require('./routes/upload.routes');
const adminRoutes = require('./routes/admin.routes');
const galleryRoutes = require('./routes/gallery.routes');

// --- Mount routes ---
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/admin', adminRoutes);
app.use('/gallery', galleryRoutes);
app.use('/file', galleryRoutes);

// --- Static file serving ---
// Serves uploaded images. Accepts auth via:
//   1. Authorization: Bearer <token> (header)
//   2. ?token=<token> (query param — for React Native Image)
const { authenticate } = require('./middleware/auth.middleware');
const applyQueryTokenAuth = (req, res, next) => {
  // If no Authorization header, check for ?token= query param
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

app.use('/files', applyQueryTokenAuth, authenticate, express.static(storagePath));

// --- Thumbnail serving ---
// GET /thumbs/:username/:filename?token=<jwt>
// Serves thumbnail immediately if ready; otherwise serves the original and
// generates the thumbnail in the background so the next request is fast.
const { ensureThumbnail, getThumbnailPath, getOriginalPath } = require('./services/thumbnail.service');
app.get('/thumbs/:username/:filename', applyQueryTokenAuth, authenticate, async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const filename = req.params.filename;

    if (!username || !filename) {
      return res.status(400).json({ error: 'Username and filename are required' });
    }

    const canAccess = req.user.role === 'admin' || req.user.username === username;
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const originalPath = getOriginalPath(username, filename);
    if (!fs.existsSync(originalPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const sendOriginal = () => {
      res.sendFile(originalPath, (err) => {
        if (err && !res.headersSent) {
          console.error('❌ Original image send error:', err.message);
          return res.status(err.statusCode || 404).json({ error: 'Image not found' });
        }
      });
    };

    const thumbPath = getThumbnailPath(username, filename);
    if (fs.existsSync(thumbPath)) {
      // Thumbnail lives under .thumbnails (a dotfolder), so explicitly allow dotfiles.
      return res.sendFile(thumbPath, { dotfiles: 'allow' }, (err) => {
        if (err && !res.headersSent) {
          console.warn('⚠️ Thumbnail send failed, falling back to original:', err.message);
          sendOriginal();
        }
      });
    }

    // Thumbnail not ready yet — serve the original NOW so gallery loads instantly,
    // then generate the thumbnail in the background for the next request.
    sendOriginal();
    ensureThumbnail(username, filename).catch(e =>
      console.warn('⚠️ Background thumb gen failed:', e.message)
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Image not found' });
    }

    console.error('❌ Thumbnail error:', error.message);
    return res.status(500).json({ error: 'Could not load thumbnail' });
  }
});

// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --- System Overview (admin) ---
// GET /system — full system stats for the admin dashboard
const { getSystemOverview } = require('./services/file.service');
const { isAdmin } = require('./middleware/admin.middleware');

app.get('/system', authenticate, isAdmin, (req, res) => {
  const overview = getSystemOverview();
  res.status(200).json(overview);
});

// --- Root route ---
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🌤️ Family Cloud Storage Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      system: 'GET /system (admin)',
      login: 'POST /auth/login',
      upload: 'POST /upload',
      gallery: 'GET /gallery',
      deleteFile: 'DELETE /file/:filename',
      files: 'GET /files/:username/:filename',
      thumbs: 'GET /thumbs/:username/:filename',
      admin: {
        users: 'GET /admin/users',
        userFiles: 'GET /admin/user/:username/files',
        createUser: 'POST /admin/create-user',
        deleteUser: 'DELETE /admin/user/:username',
        setQuota: 'PATCH /admin/set-quota',
        syncStorage: 'POST /admin/sync-storage'
      }
    }
  });
});

// ============================================
// START THE SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('===========================================');
  console.log('  🌤️  Family Cloud Storage Server');
  console.log('===========================================');
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  📡 Local:     http://localhost:${PORT}`);
  console.log(`  🌐 Network:   http://0.0.0.0:${PORT}`);
  console.log(`  💾 Storage:   ${storagePath}`);
  console.log('===========================================');
  console.log('');
});

server.on('error', (error) => {
  console.error('❌ Server listen error:', error.message);
});

server.on('close', () => {
  console.error('❌ Server closed unexpectedly');
});
