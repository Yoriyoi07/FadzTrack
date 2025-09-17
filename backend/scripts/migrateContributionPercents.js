// Migration: Recompute pic_contribution_percent for all existing project reports
// Usage (PowerShell):
//   $env:MONGODB_URI="mongodb://localhost:27017/fadztrack"; node backend/scripts/migrateContributionPercents.js
// (Or set MONGODB_URI in your environment / .env file.)

const mongoose = require('mongoose');
const Project = require('../models/Project');
const { computeContribution } = require('../utils/contribution');

(async function run(){
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fadztrack';
  console.log('[migrate] Connecting to', uri);
  await mongoose.connect(uri);

  let touchedProjects = 0;
  let touchedReports = 0;
  let skipped = 0;

  const cursor = Project.find({ 'reports.0': { $exists: true }}).cursor();
  for await (const project of cursor) {
    let changed = false;
    for (const rep of (project.reports || [])) {
      const ai = rep.ai;
      if (!ai || typeof ai !== 'object') { skipped++; continue; }

      const completed = Array.isArray(ai.completed_tasks) ? ai.completed_tasks.length : 0;
      const summary = Array.isArray(ai.summary_of_work_done) ? ai.summary_of_work_done.length : 0;

      // Detect legacy heuristic: values that are multiples of 4 between 20 and 80 when completed==summary
      // Simpler: if value < 100 and completed === summary and ai.pic_contribution_percent >= 60 && <= 85
      const current = ai.pic_contribution_percent;
      const shouldBe = computeContribution(completed, summary);
      if (current !== shouldBe) {
        ai.pic_contribution_percent = shouldBe;
        changed = true;
        touchedReports++;
      }
    }
    if (changed) { await project.save(); touchedProjects++; }
  }

  console.log(`[migrate] Updated reports: ${touchedReports} across ${touchedProjects} projects (skipped: ${skipped})`);
  await mongoose.disconnect();
  console.log('[migrate] Done');
})().catch(err => { console.error(err); process.exit(1); });
