// ============================================
// Auth Middleware — Protects routes with JWT
// ============================================
// Middleware is code that runs BEFORE your route handler.
//
// Flow:
//   Client sends request with header:
//     Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
//       ↓
//   This middleware extracts the token, verifies it,
//   and attaches the user info to req.user
//       ↓
//   If valid → continues to the route handler
//   If invalid → sends 401 and stops
// ============================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../controllers/auth.controller');

// --- authenticate ---
// Use this middleware on any route that requires login.
// Example:  router.get('/gallery', authenticate, galleryHandler);
const authenticate = (req, res, next) => {
  try {
    // --- Step 1: Get the Authorization header ---
    const authHeader = req.headers.authorization;

    // Check if the header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        hint: 'Include header: Authorization: Bearer <your-token>'
      });
    }

    // --- Step 2: Extract the token ---
    // "Bearer eyJhbGci..." → we want just "eyJhbGci..."
    const token = authHeader.split(' ')[1];

    // --- Step 3: Verify the token ---
    // jwt.verify() checks:
    //   1. Was this token signed with our secret key?
    //   2. Has it expired?
    //   3. Has it been tampered with?
    // If all checks pass, it returns the payload (username, role).
    const decoded = jwt.verify(token, JWT_SECRET);

    // --- Step 4: Attach user info to the request ---
    // Now any route handler after this middleware can access:
    //   req.user.username → "mom"
    //   req.user.role     → "user" or "admin"
    req.user = decoded;

    // --- Step 5: Continue to the next middleware/route handler ---
    // next() is how middleware says "I'm done, pass it along"
    next();

  } catch (error) {
    // Token is invalid, expired, or tampered with
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired. Please login again.'
      });
    }

    return res.status(401).json({
      error: 'Invalid token.'
    });
  }
};

module.exports = { authenticate };
