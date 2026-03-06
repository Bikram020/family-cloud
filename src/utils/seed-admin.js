// ============================================
// Seed Script — Creates the default admin user
// ============================================
// Run ONCE: node src/utils/seed-admin.js
// ============================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// --- Admin credentials ---
// CHANGE THE PASSWORD before running!
const ADMIN_MOBILE = '0000000000';    // Admin's mobile number
const ADMIN_USERNAME = 'admin';
const ADMIN_NAME = 'Admin';
const ADMIN_PASSWORD = 'admin123';    // ← Change this!

const usersFile = path.join(__dirname, '..', '..', 'data', 'users.json');

const seedAdmin = async () => {
  console.log('🌱 Seeding admin user...\n');

  let users = [];
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  }

  // Check if admin already exists
  if (users.find(u => u.username === ADMIN_USERNAME)) {
    console.log('⚠️  Admin user already exists. Skipping.');
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

  const adminUser = {
    mobile: ADMIN_MOBILE,
    username: ADMIN_USERNAME,
    name: ADMIN_NAME,
    password: hashedPassword,
    role: 'admin',
    status: 'active',
    quota: 30000,
    usedStorage: 0
  };

  users.push(adminUser);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf-8');

  console.log('✅ Admin user created!\n');
  console.log('   Mobile:   ', ADMIN_MOBILE);
  console.log('   Username: ', ADMIN_USERNAME);
  console.log('   Password: ', ADMIN_PASSWORD);
  console.log('\n📌 Login with: { "mobile": "0000000000", "password": "admin123" }');
};

seedAdmin().catch(console.error);
