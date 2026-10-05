'use strict';
const auth = require('./lib/auth');

// Dummy clinicians (based on the original hard-coded list). Emails use the reserved .test domain: nothing is ever delivered
// to them. Set DEMO_EMAIL_REDIRECT to receive their notifications in your own inbox while testing.
const DEMO_PASSWORD = 'DemoPass123!';
const WEEKDAY_9_16 = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '16:00' }));
const CLINICIANS = [
  { name: 'Dr. Paavo Salo', email: 'paavo.salo@mindsight.test', profession: 'clinical_psychologist', focus: ['anxiety', 'depression', 'burnout'], languages: ['Finnish', 'English'], price: 95, bio: 'Clinical psychologist with 12 years of experience in anxiety and mood disorders. Calm, practical, CBT-informed.', windows: WEEKDAY_9_16, reviews: [[5, 'Very compassionate and helpful.'], [5, 'Helped me manage my anxiety effectively.'], [5, 'Professional and kind.']] },
  { name: 'Dr. Amit Patel', email: 'amit.patel@mindsight.test', profession: 'psychiatrist', focus: ['depression', 'psychosis_mania', 'crisis', 'anxiety'], languages: ['English', 'Hindi'], price: 140, bio: 'Psychiatrist specialising in mood disorders, medication review and acute presentations.', windows: [{ weekday: 2, start: '10:00', end: '18:00' }, { weekday: 4, start: '10:00', end: '18:00' }], reviews: [[5, 'Expert in mood disorders.'], [5, 'Explains things clearly.'], [4, 'Great listener.']] },
  { name: 'Dr. Lauri Koivunen', email: 'lauri.koivunen@mindsight.test', profession: 'gp', focus: ['general', 'sleep', 'burnout'], languages: ['Finnish', 'English'], price: 70, bio: 'General practitioner with a special interest in stress, sleep problems and the physical side of mental health.', windows: [{ weekday: 1, start: '08:00', end: '14:00' }, { weekday: 3, start: '08:00', end: '14:00' }, { weekday: 5, start: '08:00', end: '12:00' }], reviews: [[5, 'Took my sleep problems seriously.'], [4, 'Practical and quick to help.'], [5, 'Very kind.']] },
  { name: 'Dr. Sarah Nguyen', email: 'sarah.nguyen@mindsight.test', profession: 'clinical_psychologist', focus: ['trauma', 'anxiety', 'ocd'], languages: ['English', 'Vietnamese'], price: 100, bio: 'Trauma-focused clinical psychologist (EMDR and CBT), also treating OCD and panic.', windows: [{ weekday: 1, start: '12:00', end: '19:00' }, { weekday: 2, start: '12:00', end: '19:00' }, { weekday: 3, start: '12:00', end: '19:00' }], reviews: [[5, 'Made me feel safe from the first session.'], [5, 'Helped me manage my anxiety effectively.'], [5, 'Professional and kind.']] },
  { name: 'Dr. Jukka Laine', email: 'jukka.laine@mindsight.test', profession: 'psychiatrist', focus: ['depression', 'sleep', 'general'], languages: ['Finnish', 'English', 'Swedish'], price: 130, bio: 'Psychiatrist with a focus on depression, sleep disorders and long-term follow-up.', windows: [{ weekday: 3, start: '09:00', end: '15:00' }, { weekday: 5, start: '09:00', end: '15:00' }], reviews: [[4, 'Explains things clearly.'], [4, 'Thorough and thoughtful.'], [3, 'Good, though waiting time was long.']] },
  { name: 'Lina Roberts', email: 'lina.roberts@mindsight.test', profession: 'psychotherapist', focus: ['anxiety', 'depression', 'social_isolation', 'burnout', 'ocd'], languages: ['English'], price: 80, bio: 'CBT psychotherapist offering practical strategies for anxiety, low mood and burnout. Evening sessions available.', windows: [1, 2, 3, 4].map((weekday) => ({ weekday, start: '16:00', end: '21:00' })), reviews: [[5, 'CBT sessions were life changing.'], [5, 'She gives practical strategies.'], [4, 'Warm and approachable.']] },
];

function seedDemo(db) {
  if (db.prepare('SELECT 1 FROM clinician_profiles WHERE is_demo = 1 LIMIT 1').get()) return false;
  const hash = auth.hashPassword(DEMO_PASSWORD);
  const insUser = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)');
  const patientIds = [1, 2, 3].map((i) => Number(insUser.run(`reviewer${i}@mindsight.test`, hash, `Demo Reviewer ${i}`, 'patient').lastInsertRowid));
  if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get('demo.patient@mindsight.test')) insUser.run('demo.patient@mindsight.test', hash, 'Demo Patient', 'patient');
  for (const c of CLINICIANS) {
    const id = Number(insUser.run(c.email, hash, c.name, 'clinician').lastInsertRowid);
    db.prepare(`INSERT INTO clinician_profiles (user_id, profession, bio, focus, languages, license_no, price_eur, verified, is_demo) VALUES (?,?,?,?,?,?,?,1,1)`)
      .run(id, c.profession, c.bio, JSON.stringify(c.focus), JSON.stringify(c.languages), 'DEMO-0000', c.price);
    for (const w of c.windows) db.prepare('INSERT INTO availability (clinician_id, weekday, start_time, end_time) VALUES (?,?,?,?)').run(id, w.weekday, w.start, w.end);
    c.reviews.forEach(([rating, comment], i) => db.prepare('INSERT INTO reviews (clinician_id, patient_id, rating, comment) VALUES (?,?,?,?)').run(id, patientIds[i], rating, comment));
  }
  return true;
}

function ensureAdmin(db, email, password) {
  if (!email || !password || db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return;
  db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,'admin')").run(email, auth.hashPassword(password), 'Administrator');
}
module.exports = { seedDemo, ensureAdmin, DEMO_PASSWORD, CLINICIANS };
