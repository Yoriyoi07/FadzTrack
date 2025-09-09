require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const emailArg = process.argv[2];
  const statusArg = process.argv[3] || 'Active';
  if (!emailArg) {
    console.error('Usage: node scripts/activateUserByEmail.js <email> [Status]');
    process.exit(1);
  }
  const email = String(emailArg).trim().toLowerCase();
  const status = String(statusArg).trim();

  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in environment. Create a .env with MONGO_URI.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const user = await User.findOneAndUpdate(
      { email },
      { status },
      { new: true }
    );
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(2);
    }
    console.log(`Updated ${user.email} -> status: ${user.status}`);
  } catch (err) {
    console.error('Error updating user status:', err?.message || err);
    process.exit(3);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
}

main();
