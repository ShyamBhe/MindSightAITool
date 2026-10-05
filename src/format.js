export const titleCase = (s = '') => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const severityColor = (s) =>
  ({ critical: 'error', high: 'error', moderate_high: 'warning', moderate: 'warning', low_moderate: 'info', low: 'success' }[s] || 'default');
export const fmtDateTime = (iso, tz) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', ...(tz ? { timeZone: tz } : {}) });
export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const FOCUS_LABELS = {
  anxiety: 'Anxiety & panic', depression: 'Depression & low mood', trauma: 'Trauma & abuse', psychosis_mania: 'Psychosis / mania',
  crisis: 'Crisis & self-harm', ocd: 'OCD & intrusive thoughts', burnout: 'Stress & burnout', sleep: 'Sleep', general: 'General wellbeing',
};
export const PROFESSIONS = {
  psychiatrist: 'Psychiatrist', clinical_psychologist: 'Clinical psychologist', psychotherapist: 'Psychotherapist', counselor: 'Counselor', gp: 'General practitioner',
};
