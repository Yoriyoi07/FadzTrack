#!/usr/bin/env node
const { computeContributionAdvanced } = require('../utils/contributionAdvanced');

const cases = [
  { name: 'Full completion phrases', completed: ['Structure completed','MEP installed'], summary: ['Structure completed','MEP installed'], text: 'Project XYZ 100% complete. All scopes completed. Handover complete.' },
  { name: 'Mixed with pending', completed: ['Level 5 slab poured','Columns done'], summary: ['Level 5 slab poured','Columns done','Level 6 slab pending','Level 7 rebar to be done'], text: 'Level 5 slab poured. Columns done. Level 6 slab pending. Level 7 rebar to be done. Work ongoing.' },
  { name: 'Sparse neutral', completed: [], summary: [], text: 'Site mobilization ongoing. Coordination meeting underway.' }
];

for(const c of cases){
  const res = computeContributionAdvanced({ completedTasks: c.completed, summaryTasks: c.summary, rawText: c.text });
  console.log(`\n=== ${c.name} ===`);
  console.log('Percent:', res.percent);
  console.log(res.diagnostics);
}
