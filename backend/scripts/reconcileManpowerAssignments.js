require('dotenv').config();
const mongoose = require('mongoose');
const Manpower = require('../models/Manpower');
const Project = require('../models/Project');

/*
  Reconciliation script goals:
  1. For each manpower referenced in any Project.manpower array, ensure manpower.assignedProject matches that project (if not already assigned elsewhere).
  2. If a manpower.assignedProject points to a project that no longer exists, clear it (set to null).
  3. (Optional) If a manpower has a dangling assignedProject different from all project.manpower arrays, clear it.
  4. Report summary counts.

  NOTE: This script does NOT attempt to infer project from plain text names (frontend now ignores manpower.project field and relies solely on assignedProject ref).
*/

(async function main(){
  if(!process.env.MONGO_URI){
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected');

    const projects = await Project.find({}).select('_id manpower').lean();
    const existingProjectIds = new Set(projects.map(p=> String(p._id)));

    // Build reverse index: manpowerId -> projectId (first occurrence wins; if multiple, we'll log a warning)
    const mpToProject = new Map();
    const conflicts = [];
    projects.forEach(p => {
      (p.manpower || []).forEach(mid => {
        const idStr = String(mid);
        if (!mpToProject.has(idStr)) mpToProject.set(idStr, String(p._id));
        else if (mpToProject.get(idStr) !== String(p._id)) conflicts.push({ manpower: idStr, a: mpToProject.get(idStr), b: String(p._id) });
      });
    });

    if (conflicts.length) {
      console.warn('Conflict: manpower listed in multiple projects:', conflicts.slice(0,10));
    }

    const allManpower = await Manpower.find({}).select('_id assignedProject').lean();
    let setCount = 0, clearedMissingProject = 0, clearedOrphan = 0, alreadyOk = 0;

    for (const mp of allManpower) {
      const mpId = String(mp._id);
      const expectedProject = mpToProject.get(mpId) || null;
      const current = mp.assignedProject ? String(mp.assignedProject) : null;

      if (current && !existingProjectIds.has(current)) {
        // Assigned to non-existent project -> clear
        await Manpower.updateOne({ _id: mpId }, { $set: { assignedProject: null } });
        clearedMissingProject++;
        continue;
      }

      if (!current && expectedProject) {
        await Manpower.updateOne({ _id: mpId }, { $set: { assignedProject: expectedProject } });
        setCount++;
        continue;
      }

      if (current && !expectedProject) {
        // Orphan assignment: manpower points to project but project.manpower does not include it
        await Manpower.updateOne({ _id: mpId }, { $set: { assignedProject: null } });
        clearedOrphan++;
        continue;
      }

      if (current && expectedProject && current !== expectedProject) {
        // Mismatch (different project than reverse index). We'll prefer reverse index and overwrite.
        await Manpower.updateOne({ _id: mpId }, { $set: { assignedProject: expectedProject } });
        setCount++;
        continue;
      }

      alreadyOk++;
    }

    console.log('Reconciliation complete');
    console.table({
      updatedToMatchProjectArray: setCount,
      clearedMissingProject,
      clearedOrphan,
      unchanged: alreadyOk,
      total: allManpower.length
    });

  } catch(err){
    console.error('reconcileManpowerAssignments error:', err?.message || err);
    process.exit(2);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();
