'use strict';
// Rule-based screening engine. Ported from the original React component (MentalHealthUI.js),
// now server-side so (a) rules can't be tampered with in the browser, (b) it is the guaranteed fallback
// when Gemini is unavailable, and (c) it acts as a safety net that validates Gemini's output.
const path = require('path');
const fs = require('fs');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'scoringRules.json'), 'utf8')).rules;
const CATEGORIES = RULES.map((r) => r.category);
const SEVERITY_RANK = { none: 0, low: 1, low_moderate: 2, moderate: 3, moderate_high: 4, high: 5, critical: 6 };
const SEVERITIES = Object.keys(SEVERITY_RANK);

// Which clinician focus area each rule category belongs to (used for matching).
const FOCUS_BY_CATEGORY = {
  suicide_imminent: 'crisis', suicidal_thoughts: 'crisis', self_harm: 'crisis',
  violence_imminent: 'crisis', violent_anger: 'crisis',
  sexual_violence_or_abuse: 'trauma', trauma: 'trauma',
  psychosis_possible: 'psychosis_mania', severe_disorientation: 'psychosis_mania', mania_possible: 'psychosis_mania',
  panic_attack: 'anxiety', severe_anxiety: 'anxiety', anxiety: 'anxiety',
  severe_depression: 'depression', depression: 'depression', social_isolation: 'depression',
  obsessive_or_intrusive_thoughts: 'ocd',
  burnout_overwhelm: 'burnout', sleep_problem: 'sleep',
  fatigue: 'general', irritability: 'general', minor_distress: 'general',
};
const FOCUS_AREAS = [...new Set(Object.values(FOCUS_BY_CATEGORY))];

const NEGATORS = new Set(['not', 'no', 'never', 'dont', 'didnt', 'doesnt', 'isnt', 'wasnt', 'arent', 'without']);

function normalizeText(text = '') {
  // Apostrophes are removed on both sides so "can't" / "cant" / "can’t" all compare equal.
  return String(text).toLowerCase().replace(/['’`]/g, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// Typo tolerance (anxius -> anxious). Short words excluded to avoid false positives.
function fuzzyWordMatch(word, keywordWord) {
  const a = normalizeText(word), b = normalizeText(keywordWord);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 2) return false;
  return levenshtein(a, b) <= Math.min(2, Math.max(1, Math.floor(b.length * 0.2)));
}

function isNegated(normText, keyword) {
  const idx = normText.indexOf(keyword);
  if (idx <= 0) return false;
  const before = normText.slice(0, idx).trim().split(' ').slice(-3);
  return before.some((w) => NEGATORS.has(w));
}

// Returns false | 'exact' | 'fuzzy'
function matchKeyword(normText, keyword) {
  const k = normalizeText(keyword);
  if (!normText || !k) return false;
  if (normText.includes(k)) return 'exact';
  const tw = normText.split(' '), kw = k.split(' ');
  if (kw.length === 1) return tw.some((w) => fuzzyWordMatch(w, kw[0])) ? 'fuzzy' : false;
  for (let i = 0; i <= tw.length - kw.length; i++) {
    const win = tw.slice(i, i + kw.length);
    if (kw.every((w, j) => win[j] === w || fuzzyWordMatch(win[j], w))) return 'fuzzy';
  }
  return false;
}

/**
 * Analyze text. Highest rule score wins (JSON is the source of truth; multiple keywords do not add up).
 * Negation ("I'm not anxious") suppresses non-critical matches only. Critical matches are never suppressed:
 * a false alarm is much cheaper than a missed crisis.
 */
function analyze(text) {
  const empty = { score: 0, category: 'no_detected_rule', severity: 'none', matchedKeywords: [], matches: [] };
  const norm = normalizeText(text);
  if (!norm) return empty;
  const detected = [];
  for (const rule of RULES) {
    const matchedKeywords = [];
    for (const kw of rule.keywords) {
      const hit = matchKeyword(norm, kw);
      if (!hit) continue;
      if (rule.severity !== 'critical' && hit === 'exact' && isNegated(norm, normalizeText(kw))) continue;
      matchedKeywords.push(kw);
    }
    if (matchedKeywords.length) detected.push({ category: rule.category, severity: rule.severity, score: rule.score, matchedKeywords });
  }
  if (!detected.length) return empty;
  detected.sort((a, b) => b.score - a.score);
  const top = detected[0];
  return { score: top.score, category: top.category, severity: top.severity, matchedKeywords: top.matchedKeywords, matches: detected };
}

function adviceFor(severity) {
  const table = {
    critical: [
      'What you wrote suggests you may be in danger or in a lot of pain right now. Please contact emergency or crisis support straight away.',
      'If you can, tell someone you trust where you are and how you feel, and stay with them.',
    ],
    high: [
      'This sounds like a high level of distress. Speaking with a qualified professional soon would be a good step.',
      'Slow breathing or grounding exercises can help in the moment (see the self-help guides).',
    ],
    moderate_high: [
      'Consider discussing these feelings with a healthcare professional.',
      'Relaxation, mindfulness, journaling or light exercise can help. Keep in touch with people who support you.',
    ],
    moderate: [
      'Consider talking with someone you trust.',
      'Journaling, mindfulness or relaxation exercises can help. Professional support is worth considering if this continues.',
    ],
    low_moderate: [
      'Keep an eye on how these symptoms develop.',
      'Rest, regular routines and light physical activity can help.',
    ],
    low: ['Keep healthy routines and enough rest.', 'Stay connected with supportive people and keep noticing how you feel.'],
    none: ['No specific pattern was detected. Tell me more about how you are feeling if you would like.'],
  };
  return table[severity] || table.none;
}

// Merge rule-engine output with (optional) LLM output. The safer (higher) severity always wins.
function merge(rules, llm) {
  if (!llm) return { ...rules, source: 'rules' };
  const llmMatches = (llm.categories || []).map((c) => ({ category: c.category, severity: c.severity, score: scoreFor(c), matchedKeywords: [], from: 'llm' }));
  const all = [...rules.matches.map((m) => ({ ...m, from: 'rules' })), ...llmMatches];
  const byCat = new Map();
  for (const m of all) {
    const prev = byCat.get(m.category);
    if (!prev || m.score > prev.score) byCat.set(m.category, { ...m, matchedKeywords: [...(prev?.matchedKeywords || []), ...m.matchedKeywords] });
  }
  const matches = [...byCat.values()].sort((a, b) => b.score - a.score);
  const llmRank = SEVERITY_RANK[llm.severity] ?? 0;
  const useLlm = llmRank > SEVERITY_RANK[rules.severity] || (llmRank === SEVERITY_RANK[rules.severity] && (llm.score || 0) > rules.score);
  const top = matches[0];
  const severity = useLlm ? llm.severity : rules.severity;
  const score = useLlm ? Math.max(llm.score || 0, top?.score || 0) : rules.score;
  const category = useLlm ? (top?.category || rules.category) : rules.category;
  return { score, category, severity, matchedKeywords: rules.matchedKeywords, matches, source: 'gemini+rules' };
}
function scoreFor(c) {
  const rule = RULES.find((r) => r.category === c.category);
  return rule ? rule.score : 0;
}

module.exports = { analyze, merge, adviceFor, normalizeText, CATEGORIES, SEVERITIES, SEVERITY_RANK, FOCUS_BY_CATEGORY, FOCUS_AREAS, RULES };
