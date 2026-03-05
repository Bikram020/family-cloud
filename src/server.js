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

// --- Create the Express app ---
// Think of this as creating a new "web server object"
// that we'll configure with routes and middleware.
const app = express();

// --- Configuration ---
// The port the server listens on. Default is 3000.
// You could also set this via environment variable:
//   PORT=4000 node src/server.js
const PORT = process.env.PORT || 3000;

// --- Built-in Middleware ---
// These run on EVERY request before your route handlers.

// CORS — allows the frontend (running on a different port/device)
// to make API requests without being blocked by the browser.
app.use(cors());

// express.json() — parses incoming JSON request bodies.
// When a client sends { "username": "mom", "password": "123" },
// this middleware makes it available as req.body.username, req.body.password
app.use(express.json());

// express.urlencoded() — parses form-encoded data (like HTML form submissions).
// extended: true allows nested objects in form data.
app.use(express.urlencoded({ extended: true }));

// --- Ensure storage directory exists ---
// We need the storage/user-files directory to exist before
// any uploads happen. This creates it if it doesn't exist.
const storagePath = path.join(__dirname, '..', 'storage', 'user-files');
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
  console.log('📁 Created storage directory:', storagePath);
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
// Import route files.
// Each route file handles a group of related endpoints.
const authRoutes = require('./routes/auth.routes');
const uploadRoutes = require('./routes/upload.routes');
const adminRoutes = require('./routes/admin.routes');

// --- Mount routes ---
// app.use('/auth', authRoutes) means:
//   Any route defined in auth.routes.js will be prefixed with /auth
//   So router.post('/login') becomes POST /auth/login
app.use('/auth', authRoutes);

// POST /upload → handles image uploads (requires login)
app.use('/upload', uploadRoutes);

// Admin routes → user management, quotas, storage (admin only)
app.use('/admin', adminRoutes);

// --- Static file serving ---
// Serves uploaded images so the frontend can display them.
// GET /files/mom/photo.jpg → serves storage/user-files/mom/photo.jpg
// The authenticate middleware ensures only logged-in users can view files.
const { authenticate } = require('./middleware/auth.middleware');
app.use('/files', authenticate, express.static(storagePath));

// --- Health Check ---
// This is a simple endpoint to verify the server is running.
// Hit GET http://100.x.x.x:3000/health to check.
// Returns: { status: "ok", uptime: 123.45, timestamp: "..." }
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),          // seconds since server started
    timestamp: new Date().toISOString() // current server time
  });
});

// --- Root route ---
// A friendly message when someone visits the base URL.
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🌤️ Family Cloud Storage Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      login: 'POST /auth/login',
      upload: 'POST /upload',
      gallery: 'GET /gallery             (coming in Step 7)',
      admin: {
        users: 'GET /admin/users',
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
// app.listen() tells Express to start accepting connections.
// '0.0.0.0' means "listen on ALL network interfaces",
// which is required for Tailscale to reach the server.
// Without '0.0.0.0', it might only listen on localhost
// and other devices couldn't connect.

app.listen(PORT, '0.0.0.0', () => {
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
