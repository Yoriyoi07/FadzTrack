// Quick test for updated pic_contribution_percent formula
// Run with: node backend/scripts/testContributionFormula.js

function calc(oldCompleted, oldSummary){
  const denom = Math.max(1, oldSummary);
  const oldFormula = Math.min(100, Math.round(((oldCompleted / denom) * 60) + 20));
  const newFormula = Math.round(Math.min(1, oldCompleted/denom) * 100);
  return {completed: oldCompleted, summary: oldSummary, oldFormula, newFormula};
}

const samples = [
  [0,5],[1,5],[2,5],[3,5],[4,5],[5,5],
  [1,1],[2,2],[3,3],[5,10],[8,10],[10,10]
];

console.table(samples.map(([c,s])=>calc(c,s)));

