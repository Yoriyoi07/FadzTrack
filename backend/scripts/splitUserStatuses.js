require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async function main(){
  if(!process.env.MONGO_URI){
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }
  try{
    await mongoose.connect(process.env.MONGO_URI);
    const bulk = User.collection.initializeUnorderedBulkOp();
    // Derive accountStatus from legacy status
    bulk.find({ status: { $in: ['Active','Inactive'] } }).update({ $set: { accountStatus: '$status' } });
    // Anything else: default accountStatus Active
    bulk.find({ status: { $nin: ['Active','Inactive'] } }).update({ $set: { accountStatus: 'Active' } });
    // Derive presenceStatus from legacy online/offline, otherwise offline
    bulk.find({ status: { $in: ['online','ONLINE'] } }).update({ $set: { presenceStatus: 'online' } });
    bulk.find({ status: { $in: ['offline','Offline'] } }).update({ $set: { presenceStatus: 'offline' } });
    bulk.find({ presenceStatus: { $exists: false } }).update({ $set: { presenceStatus: 'offline' } });
    const res = await bulk.execute();
    console.log('splitUserStatuses result:', res);
  } catch(err){
    console.error('splitUserStatuses error:', err?.message || err);
    process.exit(2);
  } finally {
    try{ await mongoose.disconnect(); } catch {}
  }
})();
