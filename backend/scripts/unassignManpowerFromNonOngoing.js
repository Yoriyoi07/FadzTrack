require('dotenv').config();
const mongoose = require('mongoose');
const Manpower = require('../models/Manpower');
const Project = require('../models/Project');

(async function main(){
  if(!process.env.MONGO_URI){
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }
  try{
    await mongoose.connect(process.env.MONGO_URI);

    // Find projects that are cancelled/completed/archived or soft-deleted
    const nonOngoing = await Project.find({ $or: [ { status: { $ne: 'Ongoing' } }, { isDeleted: true } ] }).select('_id status isDeleted').lean();
    const badIds = new Set(nonOngoing.map(p=> String(p._id)));
    if (badIds.size === 0) {
      console.log('No cancelled/completed/deleted projects found. Nothing to unassign.');
      return process.exit(0);
    }

    const res = await Manpower.updateMany(
      { assignedProject: { $in: Array.from(badIds) } },
      { $set: { assignedProject: null } }
    );
    console.log('Unassigned manpower from non-ongoing projects:', res?.modifiedCount || 0);
  } catch(err){
    console.error('unassignManpowerFromNonOngoing error:', err?.message || err);
    process.exit(2);
  } finally {
    try{ await mongoose.disconnect(); } catch {}
  }
})();
