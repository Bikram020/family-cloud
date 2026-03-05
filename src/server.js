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
// We'll add actual route files in the next steps.
// For now, we have a health check endpoint.

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
      login: 'POST /auth/login          (coming in Step 3)',
      upload: 'POST /upload              (coming in Step 4)',
      gallery: 'GET /gallery             (coming in Step 7)',
      admin: 'GET /admin/users           (coming in Step 6)'
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
