// Simple profanity detection utility.
// NOTE: This is a basic implementation. For production, consider a more comprehensive list
// and possibly using a mature library with locale support.

const DEFAULT_BAD_WORDS = [
  'fuck','shit','bitch','asshole','bastard','motherfucker','cunt','dick','pussy','slut','whore','bobo','putangina mo','gago','tarantado'
];

// Build regex with word boundaries; escape special chars
function buildRegex(words){
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  // Allow common suffix variants (s, es, ing, er, ers, ed, y) and tolerate trailing punctuation
  const pattern = `(?:^|[^a-z0-9])((?:${escaped.join('|')})(?:s|es|ing|er|ers|ed|y)?)($|[^a-z0-9])`;
  return new RegExp(pattern,'i');
}

let activeList = [...DEFAULT_BAD_WORDS];
let activeRegex = buildRegex(activeList);

function refresh(){ activeRegex = buildRegex(activeList); }

function setWordList(list){
  if(Array.isArray(list) && list.length){
    activeList = list.map(String);
    refresh();
  }
}

function hasProfanity(text){
  if(!text || typeof text !== 'string') return false;
  return activeRegex.test(text);
}

function findProfanities(text){
  if(!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return activeList.filter(w => new RegExp(`(?:^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:s|es|ing|er|ers|ed|y)?(?:$|[^a-z0-9])`,'i').test(lower));
}

module.exports = { hasProfanity, findProfanities, setWordList, DEFAULT_BAD_WORDS };
