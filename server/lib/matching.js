'use strict';
const { FOCUS_BY_CATEGORY, SEVERITY_RANK } = require('./screening');

// Which professions suit which situation. Weights are deliberately simple and explainable.
const PROFESSION_LABEL = {
  psychiatrist: 'Psychiatrist', clinical_psychologist: 'Clinical psychologist',
  psychotherapist: 'Psychotherapist', counselor: 'Counselor', gp: 'General practitioner',
};
function professionWeight(profession, rank, focusSet) {
  const medical = rank >= SEVERITY_RANK.high || focusSet.has('psychosis_mania') || focusSet.has('crisis');
  if (medical) return { psychiatrist: 4, clinical_psychologist: 3, gp: 1.5, psychotherapist: 1.5, counselor: 0.5 }[profession] ?? 0;
  if (rank >= SEVERITY_RANK.moderate) return { clinical_psychologist: 3, psychotherapist: 3, psychiatrist: 2, gp: 1.5, counselor: 1.5 }[profession] ?? 0;
  return { counselor: 3, psychotherapist: 2.5, clinical_psychologist: 2, gp: 2, psychiatrist: 0.5 }[profession] ?? 0;
}

/**
 * clinicians: [{id, profession, focus[], rating, reviewCount, nextSlot (ISO|null), ...}]
 * screening: {severity, matches:[{category}]}
 * Returns clinicians sorted best-first, each with `matchScore` and `reasons[]`.
 * Clinicians with no free slots are kept but ranked lower (patient can still see them).
 */
function rankClinicians(clinicians, screening) {
  const rank = SEVERITY_RANK[screening?.severity] ?? 0;
  const focusSet = new Set((screening?.matches || []).map((m) => FOCUS_BY_CATEGORY[m.category]).filter(Boolean));
  const primaryFocus = FOCUS_BY_CATEGORY[(screening?.matches || [])[0]?.category];
  const now = Date.now();
  return clinicians
    .map((c) => {
      const reasons = [];
      let score = 0;
      const matched = c.focus.filter((f) => focusSet.has(f));
      if (matched.length) { score += 3 * matched.length + (matched.includes(primaryFocus) ? 2 : 0); reasons.push(`Works with ${matched.map((f) => f.replace('_', '/')).join(', ')}`); }
      const pw = professionWeight(c.profession, rank, focusSet);
      score += pw;
      if (pw >= 3) reasons.push(`${PROFESSION_LABEL[c.profession]} suits ${rank >= SEVERITY_RANK.high ? 'higher-severity concerns' : 'your current concerns'}`);
      if (c.nextSlot) {
        const hours = (Date.parse(c.nextSlot) - now) / 36e5;
        const urgent = rank >= SEVERITY_RANK.high;
        score += hours < 48 ? (urgent ? 3 : 1.5) : hours < 24 * 7 ? (urgent ? 1 : 0.5) : 0;
        if (hours < 48) reasons.push('Has an opening within 2 days');
      } else score -= 4;
      if (c.reviewCount >= 3) score += (c.rating - 3) * 0.5;
      return { ...c, matchScore: Math.round(score * 10) / 10, reasons };
    })
    .sort((a, b) => b.matchScore - a.matchScore || (a.nextSlot || '9').localeCompare(b.nextSlot || '9'));
}

module.exports = { rankClinicians, PROFESSION_LABEL };
