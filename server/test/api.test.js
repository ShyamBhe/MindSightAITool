'use strict';
// Run: npm run test:server
const http = require('http');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Must be set BEFORE any app module is required (config is read once at load time).
let mockPort;
Object.assign(process.env, { GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: '1500', NODE_ENV: 'test', AUTO_VERIFY_CLINICIANS: 'true', GEMINI_BASE_URL: 'http://127.0.0.1:0/v1beta' });

// --- mock Gemini ---
let geminiMode = 'ok';           // ok | http500 | garbage | none-severity
let geminiCalls = 0;
const mock = http.createServer((req, res) => {
  geminiCalls++;
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (geminiMode === 'http500') { res.writeHead(500); return res.end('{}'); }
    const wrap = (t) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })); };
    if (geminiMode === 'garbage') return wrap('this is not json');
    if (geminiMode === 'none-severity') return wrap(JSON.stringify({ reply: 'Cheerful LLM reply with no concern.', categories: [], severity: 'none', score: 0 }));
    wrap(JSON.stringify({ reply: 'That sounds exhausting. How long has this been going on?', categories: [{ category: 'anxiety', severity: 'moderate' }], severity: 'moderate', score: 55 }));
  });
});

let server, base, db;
const jar = () => { let c = ''; return { get: () => c, set: (h) => { const m = (h || '').match(/ms_token=([^;]*)/); if (m) c = m[1] ? `ms_token=${m[1]}` : ''; } }; };
async function api(method, path, body, cookies) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookies?.get() ? { Cookie: cookies.get() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  cookies?.set(res.headers.get('set-cookie'));
  return { status: res.status, data: await res.json().catch(() => null) };
}

const config = require('../lib/config');
const gem = require('../lib/gemini');
before(async () => {
  await new Promise((r) => mock.listen(0, r));
  mockPort = mock.address().port;
  config.gemini.baseUrl = `http://127.0.0.1:${mockPort}/v1beta`; // config object is shared, so this takes effect immediately
  const { open } = require('../lib/db');
  const { createApp } = require('../app');
  db = open(':memory:');
  server = http.createServer(createApp(db));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mock.close(); });
beforeEach(() => { geminiMode = 'ok'; geminiCalls = 0; gem.resetBreaker(); });

// ---------- chat / Gemini / fallback ----------
test('Gemini success: uses LLM reply and merges assessment with rules', async () => {
  const r = await api('POST', '/api/chat', { message: 'I have been feeling anxious and worried all week', history: [] });
  assert.equal(r.status, 200);
  assert.equal(r.data.usedFallback, false);
  assert.match(r.data.reply, /exhausting/);
  assert.equal(r.data.screening.source, 'gemini+rules');
  assert.equal(r.data.screening.severity, 'moderate');
  assert.ok(!/\d+\/100/.test(r.data.reply), 'must not expose numeric score in chat');
});

test('Gemini HTTP 500 -> falls back to rule engine (and retried once)', async () => {
  geminiMode = 'http500';
  const r = await api('POST', '/api/chat', { message: 'I feel so anxious', history: [] });
  assert.equal(r.status, 200);
  assert.equal(r.data.usedFallback, true);
  assert.equal(r.data.screening.source, 'rules');
  assert.equal(r.data.screening.category, 'anxiety');
  assert.equal(geminiCalls, 2);
});

test('Gemini returns garbage -> falls back', async () => {
  geminiMode = 'garbage';
  const r = await api('POST', '/api/chat', { message: 'I cant sleep at all', history: [] });
  assert.equal(r.data.usedFallback, true);
  assert.equal(r.data.screening.category, 'sleep_problem');
});

test('Circuit breaker: after repeated failures Gemini is skipped (fast fallback)', async () => {
  geminiMode = 'http500';
  for (let i = 0; i < 3; i++) await api('POST', '/api/chat', { message: 'hello', history: [] });
  geminiCalls = 0;
  const r = await api('POST', '/api/chat', { message: 'hello again', history: [] });
  assert.equal(r.data.usedFallback, true);
  assert.equal(geminiCalls, 0);
});

test('SAFETY: LLM says "none" but text is suicidal -> critical + crisis resources + guaranteed crisis message', async () => {
  geminiMode = 'none-severity';
  const r = await api('POST', '/api/chat', { message: 'I want to kill myself', history: [] });
  assert.equal(r.data.screening.severity, 'critical');
  assert.ok(r.data.crisis.lines.some((l) => l.phone.includes('112')));
  assert.match(r.data.reply, /crisis line|emergency services/i);
});

test('Rules look at the whole conversation, not only the last message', async () => {
  geminiMode = 'none-severity';
  const r = await api('POST', '/api/chat', { message: 'thanks, that helps', history: [{ from: 'user', text: 'I feel completely hopeless' }, { from: 'bot', text: 'I am sorry' }] });
  assert.equal(r.data.screening.severity, 'high');
});

test('Negation: "I am not anxious" is not flagged; critical is never suppressed', async () => {
  geminiMode = 'http500';
  assert.equal((await api('POST', '/api/chat', { message: 'I am not anxious today', history: [] })).data.screening.severity, 'none');
  assert.equal((await api('POST', '/api/chat', { message: "I'm not sure but I want to die", history: [] })).data.screening.severity, 'critical');
});

test('Validation: empty / too long messages and wrong content-type', async () => {
  assert.equal((await api('POST', '/api/chat', { message: '   ' })).status, 400);
  assert.equal((await api('POST', '/api/chat', { message: 'x'.repeat(2001) })).status, 400);
  const res = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' });
  assert.equal(res.status, 415);
});

// ---------- accounts, clinicians, matching, booking, email ----------
const clinicianBody = (over = {}) => ({ role: 'clinician', name: 'Dr. Test Psych', email: 'psych@clinic.test', password: 'a-long-password-1', profile: { profession: 'clinical_psychologist', focus: ['anxiety'], languages: ['English'], licenseNo: 'REG-123', timezone: 'Europe/Helsinki', bio: 'Anxiety specialist', ...over } });
const allDays = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '09:00', end: '17:00' }));
const psych = jar(), psychiatrist = jar(), patient = jar(), patient2 = jar();
let psychId, psychiatristId;

test('Clinician registers, sets availability, becomes visible', async () => {
  const reg = await api('POST', '/api/auth/register', clinicianBody(), psych);
  assert.equal(reg.status, 201);
  psychId = reg.data.user.id;
  assert.equal((await api('GET', '/api/clinicians')).data.clinicians.length, 1);   // verified, but no slots yet
  assert.equal((await api('GET', '/api/clinicians')).data.clinicians[0].nextSlot, null);
  const av = await api('PUT', '/api/clinician/availability', { windows: allDays }, psych);
  assert.equal(av.status, 200);
  assert.ok((await api('GET', '/api/clinicians')).data.clinicians[0].nextSlot);

  const reg2 = await api('POST', '/api/auth/register', { ...clinicianBody({ profession: 'psychiatrist', focus: ['psychosis_mania', 'depression', 'crisis'] }), name: 'Dr. Test Psychiatrist', email: 'psychiatrist@clinic.test' }, psychiatrist);
  psychiatristId = reg2.data.user.id;
  await api('PUT', '/api/clinician/availability', { windows: allDays }, psychiatrist);
});

test('Clinician validation: licence required, overlapping windows rejected, patient cannot edit availability', async () => {
  assert.equal((await api('POST', '/api/auth/register', { ...clinicianBody({ licenseNo: '' }), email: 'x@y.test' })).status, 400);
  assert.equal((await api('PUT', '/api/clinician/availability', { windows: [{ weekday: 1, start: '09:00', end: '12:00' }, { weekday: 1, start: '11:00', end: '13:00' }] }, psych)).status, 400);
  assert.equal((await api('PUT', '/api/clinician/availability', { windows: [{ weekday: 1, start: '12:00', end: '09:00' }] }, psych)).status, 400);
  await api('POST', '/api/auth/register', { role: 'patient', name: 'Pat Ient', email: 'pat@example.test', password: 'a-long-password-1' }, patient);
  assert.equal((await api('PUT', '/api/clinician/availability', { windows: [] }, patient)).status, 403);
});

test('Auth: weak password rejected, duplicate email rejected, wrong password rejected', async () => {
  assert.equal((await api('POST', '/api/auth/register', { role: 'patient', name: 'A', email: 'a@b.test', password: 'short' })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { role: 'patient', name: 'Dup', email: 'PAT@example.test', password: 'a-long-password-1' })).status, 409);
  assert.equal((await api('POST', '/api/auth/login', { email: 'pat@example.test', password: 'wrong-password-xx' })).status, 401);
  assert.equal((await api('GET', '/api/auth/me', null, patient)).data.user.email, 'pat@example.test');
});

test('Matching: anxiety/moderate -> psychologist first; psychosis/high -> psychiatrist first', async () => {
  const a = (await api('GET', '/api/clinicians?severity=moderate&categories=anxiety')).data.clinicians;
  assert.equal(a[0].id, psychId);
  assert.ok(a[0].reasons.length > 0);
  const b = (await api('GET', '/api/clinicians?severity=high&categories=psychosis_possible')).data.clinicians;
  assert.equal(b[0].id, psychiatristId);
});

test('Public clinician data never leaks email or licence number', async () => {
  const c = (await api('GET', `/api/clinicians/${psychId}`)).data;
  const text = JSON.stringify(c);
  assert.ok(!text.includes('psych@clinic.test') && !text.includes('REG-123'));
});

let appt, slot;
test('Booking: requires login, validates slot, emails clinician + patient, blocks double-booking', async () => {
  const detail = (await api('GET', `/api/clinicians/${psychId}`)).data.clinician;
  slot = detail.slots[0];
  assert.equal((await api('POST', '/api/appointments', { clinicianId: psychId, startUtc: slot })).status, 401);
  assert.equal((await api('POST', '/api/appointments', { clinicianId: psychId, startUtc: '2030-01-01T03:33:00.000Z' }, patient)).status, 409); // not an offered slot

  await api('POST', '/api/chat', { message: 'I feel very anxious and worried', history: [] }, patient);
  const ok = await api('POST', '/api/appointments', { clinicianId: psychId, startUtc: slot, reason: 'Constant worry', shareSummary: true, tz: 'Europe/Helsinki' }, patient);
  assert.equal(ok.status, 201);
  appt = ok.data.appointment;

  const mails = db.prepare('SELECT * FROM email_outbox ORDER BY id').all();
  const toClinician = mails.find((m) => m.to_addr === 'psych@clinic.test' && /New appointment/.test(m.subject));
  assert.ok(toClinician, 'clinician must be emailed');
  assert.match(toClinician.body, /Pat Ient/);
  assert.match(toClinician.body, /Constant worry/);
  assert.match(toClinician.body, /Screening summary/);
  assert.ok(mails.find((m) => m.to_addr === 'pat@example.test' && /confirmed/.test(m.subject)), 'patient must be emailed');

  await api('POST', '/api/auth/register', { role: 'patient', name: 'Second Person', email: 'p2@example.test', password: 'a-long-password-1' }, patient2);
  assert.equal((await api('POST', '/api/appointments', { clinicianId: psychId, startUtc: slot }, patient2)).status, 409);
  assert.ok(!(await api('GET', `/api/clinicians/${psychId}`)).data.clinician.slots.includes(slot));
});

test('Privacy: summary is NOT shared when patient does not consent; clinician sees only own appointments', async () => {
  const slot2 = (await api('GET', `/api/clinicians/${psychId}`)).data.clinician.slots[0];
  await api('POST', '/api/appointments', { clinicianId: psychId, startUtc: slot2, reason: 'x' }, patient2);
  const list = (await api('GET', '/api/appointments', null, psych)).data.appointments;
  assert.equal(list.length, 2);
  assert.equal(list.find((a) => a.patient.name === 'Second Person').sharedSummary, null);
  assert.ok(list.find((a) => a.patient.name === 'Pat Ient').sharedSummary);
  assert.equal((await api('GET', '/api/appointments', null, psychiatrist)).data.appointments.length, 0);
  assert.equal((await api('POST', `/api/appointments/${appt.id}/cancel`, {}, patient2)).status, 404); // not theirs
});

test('Cancel frees the slot and notifies the other party', async () => {
  assert.equal((await api('POST', `/api/appointments/${appt.id}/cancel`, {}, patient)).status, 200);
  assert.ok(db.prepare("SELECT 1 FROM email_outbox WHERE to_addr='psych@clinic.test' AND subject='Appointment cancelled'").get());
  assert.ok((await api('GET', `/api/clinicians/${psychId}`)).data.clinician.slots.includes(slot));
  assert.equal((await api('POST', `/api/appointments/${appt.id}/cancel`, {}, patient)).status, 409);
});

test('Reviews require a past appointment', async () => {
  assert.equal((await api('POST', `/api/clinicians/${psychId}/reviews`, { rating: 5 }, patient)).status, 403);
});

test('Content endpoints: separate anxiety and depression guides, medicines have no dosing', async () => {
  const g = (await api('GET', '/api/guides')).data;
  assert.ok(g.guides.some((x) => x.topic === 'anxiety') && g.guides.some((x) => x.topic === 'depression'));
  const m = (await api('GET', '/api/medicines')).data;
  assert.ok(m.classes.length >= 6);
  assert.ok(!/\b\d+\s?(mg|milligram)/i.test(JSON.stringify(m)), 'no dose information allowed');
});

test('Own data: export, consent toggle, delete account removes everything', async () => {
  const d = (await api('GET', '/api/me/data', null, patient)).data;
  assert.ok(d.screenings.length >= 1 && d.chat.length >= 2);
  assert.equal((await api('PATCH', '/api/me', { researchConsent: true }, patient)).data.user.researchConsent, true);
  assert.equal((await api('DELETE', '/api/me', { password: 'nope-nope-nope' }, patient)).status, 401);
  assert.equal((await api('DELETE', '/api/me', { password: 'a-long-password-1' }, patient)).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM screenings s JOIN users u ON u.id=s.user_id WHERE u.email='pat@example.test'").get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM users WHERE email='pat@example.test'").get().c, 0);
});

test('Admin verification gate (AUTO_VERIFY off): unverified clinician hidden until admin verifies', async () => {
  db.prepare("UPDATE clinician_profiles SET verified = 0 WHERE user_id = ?").run(psychiatristId);
  assert.ok(!(await api('GET', '/api/clinicians')).data.clinicians.some((c) => c.id === psychiatristId));
  const { ensureAdmin } = require('../seed');
  ensureAdmin(db, 'admin@mindsight.test', 'admin-password-123');
  const admin = jar();
  await api('POST', '/api/auth/login', { email: 'admin@mindsight.test', password: 'admin-password-123' }, admin);
  assert.equal((await api('POST', `/api/admin/clinicians/${psychiatristId}/verify`, {}, psych)).status, 403);
  assert.equal((await api('POST', `/api/admin/clinicians/${psychiatristId}/verify`, {}, admin)).status, 200);
  assert.ok((await api('GET', '/api/clinicians')).data.clinicians.some((c) => c.id === psychiatristId));
});

test('Demo seed creates 6 dummy clinicians with availability + reviews', async () => {
  const { open } = require('../lib/db');
  const { seedDemo } = require('../seed');
  const d2 = open(':memory:');
  assert.equal(seedDemo(d2), true);
  assert.equal(seedDemo(d2), false); // idempotent
  assert.equal(d2.prepare('SELECT COUNT(*) c FROM clinician_profiles').get().c, 6);
  assert.ok(d2.prepare('SELECT COUNT(*) c FROM availability').get().c > 10);
});
