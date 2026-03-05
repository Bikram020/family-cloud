// ============================================
// Admin Middleware — Restricts routes to admins
// ============================================
// This middleware runs AFTER auth.middleware.js.
// At this point, req.user already exists (from JWT).
// We just check if the user's role is "admin".
//
// Usage chain:
//   router.post('/create-user', authenticate, isAdmin, createUser);
//                                    ↑           ↑
//                              checks JWT    checks role
// ============================================

const isAdmin = (req, res, next) => {
  // req.user was set by the authenticate middleware
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Admin privileges required.'
    });
  }

  // User is admin, continue to the route handler
  next();
};

module.exports = { isAdmin };
