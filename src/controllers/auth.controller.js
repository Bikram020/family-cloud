// ============================================
// Auth Controller — Login & Registration
// ============================================
// Handles:
//   1. POST /auth/register — new user signs up (pending approval)
//   2. POST /auth/login — login with mobile number + password
//
// User data model:
//   { mobile, username, name, password, role, status, quota, usedStorage }
//   status: "pending" (waiting for admin) | "active" (approved)
// ============================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- JWT Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'family-cloud-super-secret-key-change-me';
const JWT_EXPIRES_IN = '30d'; // 30 days — long-lived for mobile app

// --- Helpers: Read/Write users.json ---
const getUsersFilePath = () => path.join(__dirname, '..', '..', 'data', 'users.json');

const readUsers = () => {
  const data = fs.readFileSync(getUsersFilePath(), 'utf-8');
  return JSON.parse(data);
};

const writeUsers = (users) => {
  fs.writeFileSync(getUsersFilePath(), JSON.stringify(users, null, 2), 'utf-8');
};

// ============================================
// POST /auth/register
// ============================================
// Body: { mobile, username, name, password }
//
// Creates a new user with status "pending".
// They cannot login until admin approves them.
// Admin gets a notification in GET /admin/pending-users.
const register = async (req, res) => {
  try {
    const { mobile, username, name, password } = req.body;

    // --- Validate inputs ---
    if (!mobile || !username || !name || !password) {
      return res.status(400).json({
        error: 'All fields required: mobile, username, name, password'
      });
    }

    // Validate mobile number (10 digits)
    const cleanMobile = mobile.replace(/\D/g, ''); // remove non-digits
    if (cleanMobile.length !== 10) {
      return res.status(400).json({
        error: 'Mobile number must be exactly 10 digits'
      });
    }

    // Validate username (alphanumeric, 3-20 chars)
    const cleanUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({
        error: 'Username must be 3-20 characters, only letters, numbers, and underscores'
      });
    }

    // Password minimum length
    if (password.length < 4) {
      return res.status(400).json({
        error: 'Password must be at least 4 characters'
      });
    }

    // --- Check for duplicates ---
    const users = readUsers();

    if (users.find(u => u.mobile === cleanMobile)) {
      return res.status(400).json({
        error: 'This mobile number is already registered'
      });
    }

    if (users.find(u => u.username === cleanUsername)) {
      return res.status(400).json({
        error: `Username "${cleanUsername}" is already taken`
      });
    }

    // --- Hash password & create user ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      mobile: cleanMobile,
      username: cleanUsername,
      name: name.trim(),
      password: hashedPassword,
      role: 'user',
      status: 'pending',    // Must be approved by admin
      quota: 0,             // Admin sets quota during approval
      usedStorage: 0
    };

    users.push(newUser);
    writeUsers(users);

    console.log(`📝 New registration: ${newUser.name} (@${newUser.username}) — awaiting approval`);

    return res.status(201).json({
      message: 'Registration successful! Waiting for admin approval.',
      user: {
        username: newUser.username,
        name: newUser.name,
        status: newUser.status
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// POST /auth/login
// ============================================
// Body: { mobile, password }
//
// Validates credentials, checks user is "active",
// returns JWT token (valid 30 days for mobile app).
const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        error: 'Mobile number and password are required'
      });
    }

    const cleanMobile = mobile.replace(/\D/g, '');

    // Find user by mobile number
    const users = readUsers();
    const user = users.find(u => u.mobile === cleanMobile);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid mobile number or password'
      });
    }

    // Check if user is approved
    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is pending admin approval. Please wait.',
        status: 'pending'
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid mobile number or password'
      });
    }

    // Generate JWT token
    const payload = {
      username: user.username,
      mobile: user.mobile,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`✅ ${user.name} (@${user.username}) logged in`);

    return res.status(200).json({
      message: 'Login successful',
      token: token,
      user: {
        username: user.username,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        quota: user.quota,
        usedStorage: user.usedStorage
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  readUsers,
  writeUsers,
  JWT_SECRET
};
