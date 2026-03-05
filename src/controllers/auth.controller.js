// ============================================
// Auth Controller — Handles login logic
// ============================================
// This file contains the actual business logic
// for authentication. The route file just defines
// the URL path; this file does the real work.
// ============================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- JWT Secret Key ---
// This is used to SIGN and VERIFY tokens.
// In production, this should be in an environment variable.
// Anyone with this key can create valid tokens, so keep it secret!
const JWT_SECRET = process.env.JWT_SECRET || 'family-cloud-super-secret-key-change-me';

// Token expires in 7 days — so users don't have to login every hour
const JWT_EXPIRES_IN = '7d';

// --- Helper: Read users from JSON file ---
// Our "database" is just a JSON file. This reads and parses it.
const getUsersFilePath = () => path.join(__dirname, '..', '..', 'data', 'users.json');

const readUsers = () => {
  const data = fs.readFileSync(getUsersFilePath(), 'utf-8');
  return JSON.parse(data);
};

// --- Helper: Write users to JSON file ---
// Saves the updated users array back to the file.
// JSON.stringify with (null, 2) makes it pretty-printed and readable.
const writeUsers = (users) => {
  fs.writeFileSync(getUsersFilePath(), JSON.stringify(users, null, 2), 'utf-8');
};

// ============================================
// LOGIN Handler
// ============================================
// Route: POST /auth/login
// Body:  { "username": "mom", "password": "mypassword" }
//
// What it does:
// 1. Gets username & password from request body
// 2. Looks up the user in users.json
// 3. Compares the password with the stored hash using bcrypt
// 4. If valid → creates a JWT token and sends it back
// 5. If invalid → sends 401 Unauthorized

const login = async (req, res) => {
  try {
    // --- Step 1: Extract username and password from the request body ---
    const { username, password } = req.body;

    // Validate that both fields are provided
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required'
      });
    }

    // --- Step 2: Find the user in our "database" ---
    const users = readUsers();
    const user = users.find(u => u.username === username.toLowerCase());

    if (!user) {
      // Don't reveal whether the username or password was wrong
      // (security best practice — prevents username enumeration)
      return res.status(401).json({
        error: 'Invalid username or password'
      });
    }

    // --- Step 3: Compare the password ---
    // bcrypt.compare() takes the plain text password and the hash,
    // then returns true/false. It handles the salt automatically.
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid username or password'
      });
    }

    // --- Step 4: Generate a JWT token ---
    // The "payload" is the data stored INSIDE the token.
    // Anyone can decode a JWT and read the payload (it's just base64),
    // but they can't MODIFY it without the secret key.
    const payload = {
      username: user.username,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // --- Step 5: Send the token back ---
    console.log(`✅ User "${user.username}" logged in successfully`);

    return res.status(200).json({
      message: 'Login successful',
      token: token,
      user: {
        username: user.username,
        role: user.role,
        quota: user.quota,
        usedStorage: user.usedStorage
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Export the login function so routes can use it
module.exports = {
  login,
  readUsers,
  writeUsers,
  JWT_SECRET
};
