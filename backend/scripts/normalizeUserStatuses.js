require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in environment. Create a .env with MONGO_URI.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // Map legacy values: 'online'/'offline' => Active (presence should not be saved), 'Disabled' => Inactive
    const bulk = User.collection.initializeUnorderedBulkOp();
    bulk.find({ status: { $in: ['online', 'Offline', 'offline', 'ONLINE'] } }).update({ $set: { status: 'Active' } });
    bulk.find({ status: { $in: ['Disabled', 'disabled', 'DISABLED'] } }).update({ $set: { status: 'Inactive' } });
    bulk.find({ status: { $nin: ['Active', 'Inactive'] } }).update({ $set: { status: 'Active' } });
    const res = await bulk.execute();
    console.log('Normalization result:', res);
  } catch (err) {
    console.error('Error normalizing user statuses:', err?.message || err);
    process.exit(2);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
}

main();
