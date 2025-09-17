// Validation: print sample of project reports contribution percents
// Usage:
//  node backend/scripts/validateContributionPercents.js
// Ensure MONGODB_URI is set.
const mongoose = require('mongoose');
const Project = require('../models/Project');
const { computeContribution } = require('../utils/contribution');

(async function run(){
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fadztrack';
  console.log('[validate] Connecting to', uri);
  await mongoose.connect(uri);

  const projects = await Project.find({ 'reports.0': { $exists: true }}).limit(10);
  for (const p of projects) {
    console.log(`\nProject: ${p.projectName} (${p._id})`);
    (p.reports || []).slice(0,5).forEach((r, idx) => {
      const ai = r.ai || {};
      const completed = Array.isArray(ai.completed_tasks) ? ai.completed_tasks.length : 0;
      const summary = Array.isArray(ai.summary_of_work_done) ? ai.summary_of_work_done.length : 0;
      const current = ai.pic_contribution_percent;
      const expected = computeContribution(completed, summary);
      const status = current === expected ? 'OK' : `MISMATCH -> expected ${expected}`;
      console.log(`#${idx+1} repId=${r._id} comp=${completed}/${summary} pct=${current} ${status}`);
    });
  }
  await mongoose.disconnect();
  console.log('\n[validate] Done');
})().catch(e=>{ console.error(e); process.exit(1); });
