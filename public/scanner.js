// Client-side AI-tell scanner. Patterns are derived from the blader/humanizer
// skill (which is based on Wikipedia's "Signs of AI writing").
// It is a heuristic for spotting stylistic tells, not an AI detector.

const words = (list) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'gi');

export const PATTERNS = [
  { id: 'contrast', label: 'Not X but Y', weight: 3,
    re: /\b(?:not (?:just|only|merely|simply)\b[^.!?\n]{0,80}?\bbut\b|it'?s not\b[^.!?\n]{0,60}?[,;—–-]\s*it'?s\b|isn'?t (?:just|only|merely) )/gi },
  { id: 'closer', label: 'Dramatic closer', weight: 3,
    re: /\b(?:let that sink in|read that again|that'?s the real (?:win|story|point)|that distinction matters|and that changes everything|the message was clear|full stop)\b/gi },
  { id: 'saying', label: 'Deep-sounding saying', weight: 2,
    re: words(["the real question is", "at its core", "at the heart of", "what really matters", "the deeper issue", "the heart of the matter", "fundamentally", "in reality"]) },
  { id: 'runup', label: 'Staged run-up', weight: 3,
    re: words(["let'?s dive in(?:to)?", "let'?s explore", "let'?s break (?:this|it) down", "here'?s what you need to know", "without further ado", "here'?s the thing", "the thing is", "let'?s be honest", "real talk", "buckle up", "in this article,? we(?:'ll| will)"]) },
  { id: 'strawman', label: 'Arguing with no one', weight: 2,
    re: words(["i'?m not saying", "don'?t get me wrong", "this is not to say", "one might be tempted to", "a tempting approach would be", "to be clear"]) },
  { id: 'aiword', label: 'Stock AI word', weight: 2,
    re: words(["delve[sd]?", "delving", "tapestry", "testament", "pivotal", "intricate", "intricacies", "meticulous(?:ly)?", "showcas(?:e|es|ed|ing)", "underscor(?:e|es|ed|ing)", "vibrant", "bolstered", "garner(?:s|ed)?", "interplay", "enduring", "seamless(?:ly)?", "leverag(?:e|es|ed|ing)", "realm", "navigat(?:e|ing) the (?:complexities|landscape)", "ever-evolving", "game[- ]changer", "unlock(?:s|ing)? the (?:power|potential)", "elevate", "embark(?:s|ed|ing)?", "harness(?:es|ing)? the power", "crucial", "additionally", "moreover", "furthermore"]) },
  { id: 'inflated', label: 'Inflated significance', weight: 2,
    re: words(["stands as a testament", "plays? a (?:key|crucial|pivotal|vital) role", "a pivotal moment", "setting the stage for", "evolving landscape", "rapidly evolving", "in today'?s (?:fast-paced|digital|modern) (?:world|landscape|age)", "indelible mark", "lasting legacy", "the future looks bright", "exciting times ahead", "a step in the right direction", "reflects a broader"]) },
  { id: 'sales', label: 'Sales language', weight: 2,
    re: words(["nestled", "in the heart of", "breathtaking", "must-visit", "stunning", "groundbreaking", "renowned", "a diverse array", "rich (?:cultural )?heritage", "boasts", "commitment to excellence", "cutting-edge", "world-class"]) },
  { id: 'ingtail', label: 'Shallow -ing phrase', weight: 1,
    re: /,\s(?:highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|showcasing|fostering|cultivating|contributing to)\b/gi },
  { id: 'copula', label: '"Serves as" for "is"', weight: 1,
    re: words(["serves as", "stands as", "functions as", "acts as a"]) },
  { id: 'authority', label: 'Borrowed authority', weight: 2,
    re: words(["experts (?:say|argue|believe|agree)", "studies show", "research (?:shows|suggests)", "observers have", "industry reports"]) },
  { id: 'residue', label: 'Chatbot residue', weight: 4,
    re: words(["i hope this helps", "certainly!?", "of course!", "great question", "you'?re absolutely right", "let me know if", "feel free to", "as an ai(?: language model)?", "i'?d be happy to", "here is an? (?:overview|summary|breakdown)", "would you like me to", "as of my (?:last|knowledge) (?:update|cutoff)"]) },
  { id: 'cutoff', label: 'Knowledge-limit hedge', weight: 2,
    re: words(["based on available information", "not (?:widely|publicly) (?:documented|available)", "while specific details are limited", "it is believed that"]) },
  { id: 'hedge', label: 'Stacked qualifiers', weight: 1,
    re: words(["could potentially", "might arguably", "it'?s (?:also )?(?:important|worth) (?:to note|noting)", "it should be noted"]) },
  { id: 'conclusion', label: 'Template conclusion', weight: 2,
    re: words(["in conclusion", "in summary", "to sum up", "overall,", "ultimately,", "all in all"]) },
  { id: 'dash', label: 'Em/en dash', weight: 1, re: /\s?[—–]\s?|\s--\s/g },
  { id: 'curly', label: 'Curly quotes', weight: 0.5, re: /[“”‘’]/g },
  { id: 'bold', label: 'Bold decoration', weight: 1, re: /\*\*[^*\n]{1,60}\*\*/g },
  { id: 'emoji', label: 'Decorative emoji/arrow', weight: 1, re: /(?:\p{Extended_Pictographic}|→)/gu },
];

export function countWords(text) {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Returns { matches:[{start,end,id,label}], byPattern:{id:{label,count}}, score, density, words } */
export function scan(text) {
  const raw = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      if (m[0].length === 0) { p.re.lastIndex++; continue; }
      raw.push({ start: m.index, end: m.index + m[0].length, id: p.id, label: p.label, weight: p.weight });
    }
  }
  // Remove overlaps, preferring earlier and higher-weight matches.
  raw.sort((a, b) => a.start - b.start || b.weight - a.weight);
  const matches = [];
  let lastEnd = -1;
  for (const r of raw) {
    if (r.start >= lastEnd) { matches.push(r); lastEnd = r.end; }
  }

  // Uniform sentence length ("low burstiness") check.
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => countWords(s)).filter((n) => n > 2);
  let burst = null;
  if (sentences.length >= 5) {
    const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
    const sd = Math.sqrt(sentences.reduce((a, b) => a + (b - mean) ** 2, 0) / sentences.length);
    burst = mean ? sd / mean : 0; // coefficient of variation
  }

  const byPattern = {};
  let weighted = 0;
  for (const m of matches) {
    byPattern[m.id] ??= { label: m.label, count: 0 };
    byPattern[m.id].count++;
    weighted += m.weight;
  }
  if (burst !== null && burst < 0.3) {
    byPattern.rhythm = { label: 'Uniform sentence length', count: 1 };
    weighted += 3;
  }

  const w = countWords(text);
  const density = w ? (weighted / w) * 100 : 0; // weighted tells per 100 words
  // Map density onto a 0–100 "AI-tell" score with a soft curve.
  const score = Math.round(100 * (1 - Math.exp(-density / 6)));
  return { matches, byPattern, score, density, words: w, burst };
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function highlight(text, matches) {
  let out = '';
  let i = 0;
  for (const m of matches) {
    out += esc(text.slice(i, m.start));
    out += `<mark class="tell tell-${m.id}" title="${esc(m.label)}">${esc(text.slice(m.start, m.end))}</mark>`;
    i = m.end;
  }
  return out + esc(text.slice(i));
}

/** Deterministic cleanup for leftover dash/quote tells (only used when no voice sample). */
export function strictCleanup(text) {
  // Leave fenced and inline code untouched.
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) return part;
    return part
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/(\d)\s?–\s?(\d)/g, '$1-$2') // numeric ranges keep a hyphen
      .replace(/\s+[—–]\s+|\s+--\s+/g, ', ')
      .replace(/(\w)[—–](\w)/g, '$1, $2')
      .replace(/,\s*([.!?;:])/g, '$1');
  }).join('');
}
