require('fs');
const fs = require('fs');
const path = require('path');
const { sumBudgetFromPdfBuffer } = require('../utils/budgetPdf');

(async function main(){
  const pdfPath = process.argv[2];
  if(!pdfPath){
    console.error('Usage: node scripts/testBudgetParse.js <path-to-pdf>');
    process.exit(1);
  }
  const abs = path.resolve(pdfPath);
  if(!fs.existsSync(abs)){
    console.error('File not found:', abs);
    process.exit(2);
  }
  try{
    const buf = fs.readFileSync(abs);
    const res = await sumBudgetFromPdfBuffer(buf);
    console.log(JSON.stringify(res, null, 2));
  }catch(err){
    console.error('Parse error:', err?.message || err);
    process.exit(3);
  }
})();
