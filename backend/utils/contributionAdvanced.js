// Advanced PPT completion & PiC contribution scoring
// Combines structured task counts with keyword signal analysis to better estimate real completion.
// computeContributionAdvanced({ completedTasks, summaryTasks, rawText }) -> { percent, diagnostics }
// diagnostics: { doneCt,sumCt,completedKeywordCount,pendingKeywordCount,progressKeywordCount,fullCompletionHits,baseRatio,adjustedRatio,adjustmentsApplied[] }

const COMPLETION_KEYWORDS = [
  'completed','finished','done','achieved','installed','commissioned','handover complete','100%','finalized','closed out','accomplished','substantially complete'
];
const PENDING_KEYWORDS = [
  'pending','to be done','remaining','to complete','outstanding','delayed','not started','yet to','awaiting','balance work','carry over'
];
const PROGRESS_KEYWORDS = [
  'in progress','ongoing','progressing','continuing','underway','work continues'
];
const FULL_COMPLETION_PHRASES = [
  '100% complete','fully completed','final completion','all scopes completed','all works completed','project completion'
];

function countOccurrences(text, list){
  let total = 0;
  for(const kw of list){
    const re = new RegExp(kw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'),'gi');
    const m = text.match(re);
    if(m) total += m.length;
  }
  return total;
}

function computeContributionAdvanced({ completedTasks = [], summaryTasks = [], rawText = '' } = {}) {
  const doneCt = Array.isArray(completedTasks) ? completedTasks.length : 0;
  const sumCt  = Array.isArray(summaryTasks) ? summaryTasks.length : 0;
  const text = (rawText || '').toLowerCase();

  const completedKeywordCount = countOccurrences(text, COMPLETION_KEYWORDS);
  const pendingKeywordCount   = countOccurrences(text, PENDING_KEYWORDS);
  const progressKeywordCount  = countOccurrences(text, PROGRESS_KEYWORDS);
  const fullCompletionHits    = countOccurrences(text, FULL_COMPLETION_PHRASES);

  let baseRatio;
  if(sumCt > 0) {
    baseRatio = Math.min(1, doneCt / Math.max(1,sumCt));
  } else if (completedKeywordCount + pendingKeywordCount > 0) {
    baseRatio = completedKeywordCount / (completedKeywordCount + pendingKeywordCount);
  } else {
    baseRatio = 0.5; // neutral baseline when no signals
  }

  let adjusted = baseRatio;
  const adjustmentsApplied = [];

  if(pendingKeywordCount > 0 && completedKeywordCount === 0 && adjusted > 0.4){
    adjusted -= 0.25; adjustmentsApplied.push('penalize_pending_no_completed_keywords');
  }
  if(fullCompletionHits > 0 && pendingKeywordCount === 0){
    if(adjusted < 0.9){ adjusted = Math.min(1, Math.max(adjusted, 0.95)); adjustmentsApplied.push('boost_full_completion_phrase'); }
  }
  if(/handover|turnover/.test(text) && pendingKeywordCount === 0){
    adjusted = Math.min(1, adjusted + 0.03); adjustmentsApplied.push('boost_handover_no_pending');
  }
  if(pendingKeywordCount > completedKeywordCount * 2 && pendingKeywordCount >= 2){
    adjusted = Math.max(0, adjusted - 0.15); adjustmentsApplied.push('penalize_pending_dominant');
  }
  if(doneCt > 0 && adjusted < 0.05){
    adjusted = Math.min(0.25, Math.max(adjusted, doneCt / Math.max(1,(sumCt||doneCt)))); adjustmentsApplied.push('floor_some_completions');
  }

  adjusted = Math.max(0, Math.min(1, adjusted));
  const percent = Math.round(adjusted * 100);

  return {
    percent,
    diagnostics: {
      doneCt,
      sumCt,
      completedKeywordCount,
      pendingKeywordCount,
      progressKeywordCount,
      fullCompletionHits,
      baseRatio: Number(baseRatio.toFixed(4)),
      adjustedRatio: Number(adjusted.toFixed(4)),
      adjustmentsApplied
    }
  };
}

module.exports = { computeContributionAdvanced };
