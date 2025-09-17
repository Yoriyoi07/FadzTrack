#!/usr/bin/env node
/**
 * Migration: Backfill advanced contribution scoring for existing reports.
 *
 * For each project report lacking `ai.pic_contribution_percent_advanced`:
 *  1. Load the report's stored AI JSON (if present) or use embedded ai object.
 *  2. If advanced already computed, skip.
 *  3. Try to fetch original PPTX from Supabase (using report.path) and re-extract text.
 *     - If extraction fails, fall back to concatenating summary/completed arrays as pseudo-text.
 *  4. Run computeContributionAdvanced and attach:
 *       - (REMOVED) advanced scoring fields no longer in active use
 *  5. Persist the updated AI object inside the project document.
 *
 * Safe guards:
 *  - Dry-run mode via DRY_RUN=1 (does not persist changes)
 *  - Limit number of updated reports via LIMIT=n
 *  - Resume capability: script can be re-run; already migrated items skipped.
 */

const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const Project = require('../models/Project');
const { extractPptText } = require('../utils/pptExtract');
const { computeContributionAdvanced } = require('../utils/contributionAdvanced');
const supabase = require('../utils/supabaseClient');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fadztrack';
const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT,10) : Infinity;

async function fetchPptBuffer(storagePath){
  try {
    const { data, error } = await supabase.storage.from('documents').download(storagePath);
    if(error || !data) throw error || new Error('No data');
    const arrBuf = await data.arrayBuffer();
    return Buffer.from(arrBuf);
  } catch(e){
    console.warn(`  PPT download failed for ${storagePath}: ${e.message}`);
    return null;
  }
}

function pseudoTextFromAi(ai){
  const parts = [];
  if(Array.isArray(ai.summary_of_work_done)) parts.push(ai.summary_of_work_done.join('\n'));
  if(Array.isArray(ai.completed_tasks)) parts.push(ai.completed_tasks.join('\n'));
  return parts.join('\n');
}

async function migrate(){
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  console.log('Connected to Mongo');

  const cursor = Project.find({}, { reports: 1 }).cursor();
  let updatedReports = 0;
  let scannedReports = 0;
  let projectsTouched = 0;

  for await (const project of cursor){
    let projectChanged = false;
    for(const rep of project.reports || []){
      scannedReports++;
      if(updatedReports >= LIMIT) break;
      const ai = rep.ai;
      if(!ai || typeof ai !== 'object') continue;
      // Advanced scoring deprecated; script retained for reference but skips action.
      continue;

      console.log(`Project ${project._id} report ${rep._id} -> migrating`);
      let text = '';
      // Prefer re-extraction for highest fidelity
      if(rep.path){
        const pptBuf = await fetchPptBuffer(rep.path);
        if(pptBuf){
          try { text = await extractPptText(pptBuf); } catch(e){ console.warn('  Extraction error:', e.message); }
        }
      }
      if(!text){
        text = pseudoTextFromAi(ai);
      }

      if(updatedReports >= LIMIT) break;
    }

    if(projectChanged){
      projectsTouched++;
      if(!DRY_RUN){
        try {
          await project.save();
        } catch(e){
          console.error('  Save failed:', e.message);
        }
      }
    }
    if(updatedReports >= LIMIT) break;
  }

  console.log('\nMigration complete');
  console.log(' Scanned reports:', scannedReports);
  console.log(' Updated reports:', updatedReports, DRY_RUN ? '(dry-run)' : '');
  console.log(' Projects touched:', projectsTouched);

  await mongoose.disconnect();
}

migrate().catch(e => { console.error('Fatal migration error:', e); process.exit(1); });
