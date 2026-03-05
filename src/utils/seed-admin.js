// ============================================
// Seed Script — Creates the default admin user
// ============================================
// Run this ONCE to set up the first admin account:
//   node src/utils/seed-admin.js
//
// This creates an admin user in data/users.json
// with a bcrypt-hashed password.
// ============================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// --- Admin credentials ---
// CHANGE THESE before running!
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';  // ← Change this to something stronger!

const usersFile = path.join(__dirname, '..', '..', 'data', 'users.json');

const seedAdmin = async () => {
  console.log('🌱 Seeding admin user...\n');

  // Read existing users
  let users = [];
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  }

  // Check if admin already exists
  const existingAdmin = users.find(u => u.username === ADMIN_USERNAME);
  if (existingAdmin) {
    console.log(`⚠️  User "${ADMIN_USERNAME}" already exists. Skipping.`);
    return;
  }

  // --- Hash the password ---
  // bcrypt.genSalt(10) generates a "salt" — random data mixed into the hash.
  // The number 10 is the "salt rounds" (cost factor).
  // Higher = more secure but slower. 10 is a good default.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

  // --- Create the admin user object ---
  const adminUser = {
    username: ADMIN_USERNAME,
    password: hashedPassword,    // NEVER store plain text passwords!
    role: 'admin',
    quota: 30000,                // 30GB quota for admin (in MB)
    usedStorage: 0               // No files uploaded yet
  };

  // --- Save to users.json ---
  users.push(adminUser);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf-8');

  console.log('✅ Admin user created successfully!\n');
  console.log('   Username:', ADMIN_USERNAME);
  console.log('   Password:', ADMIN_PASSWORD);
  console.log('   Role:    ', adminUser.role);
  console.log('   Quota:   ', adminUser.quota, 'MB');
  console.log('\n📌 You can now login with POST /auth/login');
  console.log('   Body: { "username": "admin", "password": "admin123" }');
};

seedAdmin().catch(console.error);
