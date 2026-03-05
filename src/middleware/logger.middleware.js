// ============================================
// Request Logger Middleware
// ============================================
// Logs every incoming request with:
//   - Timestamp
//   - HTTP method (GET, POST, etc.)
//   - URL path
//   - Response status code
//   - How long it took to process
//
// This is useful for monitoring your server and
// debugging issues. You'll see output like:
//   [2026-03-06 00:45:00] POST /auth/login → 200 (45ms)
// ============================================

const logger = (req, res, next) => {
  const start = Date.now();

  // Get the current time formatted nicely
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // res.on('finish') fires AFTER the response is sent
  // This is how we measure response time and capture the status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Color-code by status: green for success, red for errors
    const statusIcon = status < 400 ? '✅' : '❌';

    console.log(`  ${statusIcon} [${now}] ${req.method} ${req.originalUrl} → ${status} (${duration}ms)`);
  });

  next();
};

module.exports = { logger };
