'use strict';
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { tx } = require('./lib/db');
const { HttpError, readJson, send, rateLimiter } = require('./lib/http');
const auth = require('./lib/auth');
const screening = require('./lib/screening');
const gemini = require('./lib/gemini');
const { rankClinicians, PROFESSION_LABEL } = require('./lib/matching');
const { generateSlots, validTime, validTz, toMin } = require('./lib/availability');
const { sendMail } = require('./lib/mailer');
const { getCrisisResources, CRISIS_MESSAGE } = require('./lib/crisis');

const GUIDES = require('./data/guides.json');
const MEDICINES = require('./data/medicines.json');
const PROFESSIONS = Object.keys(PROFESSION_LABEL);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const j = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const fmt = (iso, tz) => new Date(iso).toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }) + ` (${tz})`;
const str = (v, max, name) => {
  if (typeof v !== 'string') throw new HttpError(400, `${name} must be text`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(400, `${name} is too long (max ${max})`);
  return t;
};

function createApp(db, opts = {}) {
  const authLimit = rateLimiter(15, 60_000);
  const chatLimit = rateLimiter(30, 60_000);
  const buildDir = opts.buildDir || path.join(__dirname, '..', 'build');

  // ---------- helpers ----------
  const publicUser = (u) => u && { id: u.id, email: u.email, name: u.name, role: u.role, researchConsent: !!u.research_consent };

  function requireUser(ctx, ...roles) {
    if (!ctx.user) throw new HttpError(401, 'Please log in');
    if (roles.length && !roles.includes(ctx.user.role)) throw new HttpError(403, 'Not allowed');
    return ctx.user;
  }

  function clinicianRows({ onlyVisible = true, id } = {}) {
    let sql = `SELECT u.id, u.name, p.profession, p.bio, p.focus, p.languages, p.timezone, p.session_minutes, p.price_eur,
                      p.verified, p.accepting, p.is_demo,
                      (SELECT AVG(rating) FROM reviews r WHERE r.clinician_id = u.id) AS rating,
                      (SELECT COUNT(*) FROM reviews r WHERE r.clinician_id = u.id) AS review_count
               FROM users u JOIN clinician_profiles p ON p.user_id = u.id WHERE u.role = 'clinician'`;
    const args = [];
    if (onlyVisible) sql += ' AND p.verified = 1 AND p.accepting = 1';
    if (id) { sql += ' AND u.id = ?'; args.push(id); }
    return db.prepare(sql).all(...args);
  }

  function slotsFor(row, days = 14) {
    const windows = db.prepare('SELECT weekday, start_time, end_time FROM availability WHERE clinician_id = ?').all(row.id);
    const booked = new Set(db.prepare("SELECT start_utc FROM appointments WHERE clinician_id = ? AND status != 'cancelled' AND start_utc > ?")
      .all(row.id, new Date().toISOString()).map((r) => r.start_utc));
    return generateSlots({ windows, timezone: row.timezone, sessionMinutes: row.session_minutes, booked, days });
  }

  function toPublic(row, withSlots = false) {
    const slots = slotsFor(row);
    const out = {
      id: row.id, name: row.name, profession: row.profession, professionLabel: PROFESSION_LABEL[row.profession],
      bio: row.bio, focus: j(row.focus, []), languages: j(row.languages, []), timezone: row.timezone,
      sessionMinutes: row.session_minutes, priceEur: row.price_eur,
      rating: row.rating ? Math.round(row.rating * 10) / 10 : null, reviewCount: row.review_count,
      nextSlot: slots[0] || null, isDemo: !!row.is_demo,
    };
    if (withSlots) out.slots = slots;
    return out;
  }

  function latestScreening(userId) {
    const r = db.prepare('SELECT * FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    return r && { ...r, matches: j(r.matches, []) };
  }

  function validateProfile(b, { requireLicense }) {
    const profession = b.profession;
    if (!PROFESSIONS.includes(profession)) throw new HttpError(400, `profession must be one of: ${PROFESSIONS.join(', ')}`);
    const focus = (Array.isArray(b.focus) ? b.focus : []).filter((f) => screening.FOCUS_AREAS.includes(f));
    if (!focus.length) throw new HttpError(400, `Choose at least one focus area (${screening.FOCUS_AREAS.join(', ')})`);
    const languages = (Array.isArray(b.languages) ? b.languages : ['English']).map((l) => str(String(l), 30, 'language')).filter(Boolean).slice(0, 8);
    const timezone = b.timezone || 'Europe/Helsinki';
    if (!validTz(timezone)) throw new HttpError(400, 'Invalid timezone');
    const sessionMinutes = Number(b.sessionMinutes ?? 50);
    if (!(sessionMinutes >= 20 && sessionMinutes <= 120)) throw new HttpError(400, 'Session length must be 20-120 minutes');
    const priceEur = b.priceEur === '' || b.priceEur == null ? null : Number(b.priceEur);
    if (priceEur !== null && !(priceEur >= 0 && priceEur <= 1000)) throw new HttpError(400, 'Invalid price');
    const licenseNo = str(b.licenseNo ?? '', 80, 'licenseNo');
    if (requireLicense && !licenseNo) throw new HttpError(400, 'A professional licence / registration number is required');
    return { profession, focus, languages, timezone, sessionMinutes, priceEur, licenseNo, bio: str(b.bio ?? '', 1500, 'bio') };
  }

  // ---------- routes ----------
  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler });

  route('GET', '/api/health', () => ({ ok: true, gemini: !!config.gemini.key, smtp: !!config.smtp.host, demoSeed: config.seedDemo }));

  // ----- auth -----
  route('POST', '/api/auth/register', async (ctx) => {
    if (!authLimit(ctx.ip)) throw new HttpError(429, 'Too many attempts, try again in a minute');
    const b = ctx.body;
    const email = str(b.email ?? '', 200, 'email').toLowerCase();
    const name = str(b.name ?? '', 100, 'name');
    const password = typeof b.password === 'string' ? b.password : '';
    const role = b.role === 'clinician' ? 'clinician' : 'patient';
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email');
    if (!name) throw new HttpError(400, 'Name is required');
    if (password.length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
    const profile = role === 'clinician' ? validateProfile(b.profile || {}, { requireLicense: true }) : null;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'An account with this email already exists');
    const id = tx(db, () => {
      const uid = Number(db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)').run(email, auth.hashPassword(password), name, role).lastInsertRowid);
      if (profile) db.prepare(`INSERT INTO clinician_profiles (user_id, profession, bio, focus, languages, license_no, timezone, session_minutes, price_eur, verified)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid, profile.profession, profile.bio, JSON.stringify(profile.focus), JSON.stringify(profile.languages), profile.licenseNo, profile.timezone, profile.sessionMinutes, profile.priceEur, config.autoVerifyClinicians ? 1 : 0);
      return uid;
    });
    if (role === 'clinician') {
      await sendMail(db, { to: email, subject: 'Welcome to MindSight', text: `Hi ${name},\n\nYour clinician account has been created. ${config.autoVerifyClinicians ? 'You are visible to patients once you add availability.' : 'An administrator will verify your registration before you appear to patients.'}\n\nAdd your weekly availability in the Clinician area: ${config.appUrl}\n` });
      if (!config.autoVerifyClinicians && config.adminEmail) await sendMail(db, { to: config.adminEmail, subject: 'New clinician awaiting verification', text: `${name} (${email}) registered as ${profile.profession}. Licence: ${profile.licenseNo}.\nReview in the Admin area.` });
    }
    const token = auth.signToken({ uid: id });
    return { status: 201, headers: { 'Set-Cookie': auth.sessionCookie(token) }, data: { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) } };
  });

  route('POST', '/api/auth/login', (ctx) => {
    if (!authLimit(ctx.ip)) throw new HttpError(429, 'Too many attempts, try again in a minute');
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(ctx.body.email || '').trim());
    // Same error for unknown email and wrong password.
    if (!u || !auth.verifyPassword(String(ctx.body.password || ''), u.password_hash)) throw new HttpError(401, 'Incorrect email or password');
    return { headers: { 'Set-Cookie': auth.sessionCookie(auth.signToken({ uid: u.id })) }, data: { user: publicUser(u) } };
  });
  route('POST', '/api/auth/logout', () => ({ headers: { 'Set-Cookie': auth.sessionCookie('', 0) }, data: { ok: true } }));
  route('GET', '/api/auth/me', (ctx) => ({ user: publicUser(ctx.user) }));

  // ----- chat + screening -----
  route('POST', '/api/chat', async (ctx) => {
    if (!chatLimit(ctx.ip)) throw new HttpError(429, 'You are sending messages very quickly. Please wait a moment.');
    const message = str(ctx.body.message ?? '', 2000, 'message');
    if (!message) throw new HttpError(400, 'Message is empty');
    const history = (Array.isArray(ctx.body.history) ? ctx.body.history : []).slice(-20)
      .filter((m) => m && typeof m.text === 'string' && (m.from === 'user' || m.from === 'bot'))
      .map((m) => ({ from: m.from, text: m.text.slice(0, 2000) }));

    // 1. Rule engine over the WHOLE conversation (not just the last message).
    const userText = [...history.filter((m) => m.from === 'user').map((m) => m.text), message].join('. ');
    const rules = screening.analyze(userText);

    // 2. Gemini (reply + independent assessment). Any failure -> fall back to the original rule-based behaviour.
    let llm = null, llmError = null;
    try { llm = await gemini.chat(history, message); }
    catch (e) { llmError = String(e.message || e); if (config.gemini.key) console.warn('[gemini] falling back to rules:', llmError); }

    const result = screening.merge(rules, llm);
    const critical = result.severity === 'critical';
    let reply = llm ? llm.reply : fallbackReply(result.severity);
    if (critical) reply = `${CRISIS_MESSAGE}\n\n${llm ? llm.reply : ''}`.trim(); // safety text is guaranteed, whatever the LLM said

    const out = {
      reply,
      usedFallback: !llm,
      fallbackReason: llm ? null : (config.gemini.key ? 'llm_unavailable' : 'llm_not_configured'),
      screening: { score: result.score, category: result.category, severity: result.severity, matches: result.matches, source: result.source, advice: screening.adviceFor(result.severity) },
      crisis: critical ? getCrisisResources(config.crisisCountry) : null,
    };
    if (ctx.user) {
      db.prepare('INSERT INTO chat_messages (user_id, role, text) VALUES (?,?,?)').run(ctx.user.id, 'user', message);
      db.prepare('INSERT INTO chat_messages (user_id, role, text) VALUES (?,?,?)').run(ctx.user.id, 'bot', reply);
      if (result.severity !== 'none') db.prepare('INSERT INTO screenings (user_id, score, category, severity, matches, source) VALUES (?,?,?,?,?,?)')
        .run(ctx.user.id, result.score, result.category, result.severity, JSON.stringify(result.matches), result.source);
    }
    return out;
  });

  function fallbackReply(severity) {
    const base = {
      none: "Thanks for sharing. I'm here to listen. Could you tell me a little more about how you've been feeling lately?",
      low: "Thank you for telling me. That sounds like a tough stretch. What do you think has been weighing on you most?",
      low_moderate: "Thank you for sharing that. It sounds like it's been affecting you. How long has it been going on?",
      moderate: "I'm sorry you're dealing with this. It's good that you're talking about it. How is it affecting your daily life?",
      moderate_high: "That sounds really hard, and I'm glad you reached out. How are you coping at the moment?",
      high: "I'm really sorry you're going through this, it sounds very intense. You don't have to handle it alone. Is there someone who can be with you right now?",
    };
    return (base[severity] || base.none) + ' I can also show you clinicians who may be able to help, in the Results tab.';
  }

  // ----- clinicians (patient-facing) -----
  route('GET', '/api/clinicians', (ctx) => {
    const cats = (ctx.query.get('categories') || '').split(',').filter((c) => screening.CATEGORIES.includes(c));
    const severity = screening.SEVERITIES.includes(ctx.query.get('severity')) ? ctx.query.get('severity') : 'none';
    const list = clinicianRows().map((r) => toPublic(r));
    return { clinicians: rankClinicians(list, { severity, matches: cats.map((category) => ({ category })) }) };
  });
  route('GET', '/api/clinicians/:id', (ctx) => {
    const row = clinicianRows({ id: Number(ctx.params.id) })[0];
    if (!row) throw new HttpError(404, 'Clinician not found');
    const reviews = db.prepare(`SELECT r.rating, r.comment, r.created_at, u.name AS patient FROM reviews r JOIN users u ON u.id = r.patient_id WHERE r.clinician_id = ? ORDER BY r.id DESC LIMIT 20`).all(row.id)
      .map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.created_at, author: r.patient.split(' ')[0] })); // first name only
    return { clinician: toPublic(row, true), reviews };
  });
  route('POST', '/api/clinicians/:id/reviews', (ctx) => {
    const u = requireUser(ctx, 'patient');
    const cid = Number(ctx.params.id);
    const rating = Number(ctx.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be 1-5');
    const had = db.prepare("SELECT 1 FROM appointments WHERE patient_id = ? AND clinician_id = ? AND status != 'cancelled' AND end_utc < ?").get(u.id, cid, new Date().toISOString());
    if (!had) throw new HttpError(403, 'You can review a clinician after a completed appointment');
    db.prepare(`INSERT INTO reviews (clinician_id, patient_id, rating, comment) VALUES (?,?,?,?)
      ON CONFLICT(clinician_id, patient_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment`).run(cid, u.id, rating, str(ctx.body.comment ?? '', 800, 'comment'));
    return { status: 201, data: { ok: true } };
  });

  // ----- appointments -----
  route('POST', '/api/appointments', async (ctx) => {
    const u = requireUser(ctx, 'patient');
    const cid = Number(ctx.body.clinicianId);
    const start = new Date(String(ctx.body.startUtc || ''));
    if (!cid || isNaN(start)) throw new HttpError(400, 'clinicianId and startUtc are required');
    const startIso = start.toISOString();
    const row = clinicianRows({ id: cid })[0];
    if (!row) throw new HttpError(404, 'Clinician not found or not accepting patients');
    if (!slotsFor(row).includes(startIso)) throw new HttpError(409, 'That time is not available any more. Please pick another slot.');
    const endIso = new Date(start.getTime() + row.session_minutes * 60_000).toISOString();
    const reason = str(ctx.body.reason ?? '', 1000, 'reason');
    let summary = null;
    if (ctx.body.shareSummary) {
      const s = latestScreening(u.id);
      if (s) summary = `Screening summary (shared by patient with consent): severity ${s.severity.replace('_', ' ')}, main area ${String(s.category).replace(/_/g, ' ')}, indicators: ${s.matches.map((m) => m.category.replace(/_/g, ' ')).join(', ') || 'none'}. This is an automated screening, not a diagnosis.`;
    }
    let id;
    try {
      id = Number(db.prepare('INSERT INTO appointments (patient_id, clinician_id, start_utc, end_utc, reason, shared_summary) VALUES (?,?,?,?,?,?)')
        .run(u.id, cid, startIso, endIso, reason, summary).lastInsertRowid);
    } catch (e) {
      if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, 'That slot has just been taken. Please pick another.');
      throw e;
    }
    const clinicianUser = db.prepare('SELECT email, name FROM users WHERE id = ?').get(cid);
    const patientTz = validTz(ctx.body.tz) ? ctx.body.tz : row.timezone;
    await sendMail(db, {
      to: clinicianUser.email,
      subject: `New appointment: ${u.name}, ${new Date(startIso).toLocaleDateString('en-GB', { timeZone: row.timezone })}`,
      text: `Hello ${clinicianUser.name},\n\nA new appointment has been booked through MindSight.\n\nPatient: ${u.name}\nWhen: ${fmt(startIso, row.timezone)}\nLength: ${row.session_minutes} min\nReason given: ${reason || '(none)'}\n${summary ? '\n' + summary + '\n' : '\nThe patient did not share a screening summary.\n'}\nManage your appointments: ${config.appUrl}\n`,
    });
    await sendMail(db, {
      to: u.email,
      subject: `Your appointment with ${clinicianUser.name} is confirmed`,
      text: `Hello ${u.name},\n\nYour appointment is confirmed.\n\nWith: ${clinicianUser.name} (${PROFESSION_LABEL[row.profession]})\nWhen: ${fmt(startIso, patientTz)}\nLength: ${row.session_minutes} min\n\nYou can cancel from the "Your data" page.\n\nIf you are in crisis or in immediate danger, call 112 (Finland) or your local emergency number right away.\n`,
    });
    return { status: 201, data: { appointment: { id, clinicianId: cid, startUtc: startIso, endUtc: endIso, status: 'confirmed' } } };
  });

  const mapAppt = (a, viewer) => ({
    id: a.id, startUtc: a.start_utc, endUtc: a.end_utc, status: a.status, reason: a.reason,
    clinician: { id: a.clinician_id, name: a.clinician_name },
    ...(viewer.role === 'clinician' ? { patient: { id: a.patient_id, name: a.patient_name }, sharedSummary: a.shared_summary } : {}),
  });
  route('GET', '/api/appointments', (ctx) => {
    const u = requireUser(ctx, 'patient', 'clinician');
    const col = u.role === 'clinician' ? 'clinician_id' : 'patient_id';
    const rows = db.prepare(`SELECT a.*, c.name AS clinician_name, p.name AS patient_name FROM appointments a
      JOIN users c ON c.id = a.clinician_id JOIN users p ON p.id = a.patient_id WHERE a.${col} = ? ORDER BY a.start_utc DESC`).all(u.id);
    return { appointments: rows.map((a) => mapAppt(a, u)) };
  });

  async function changeStatus(ctx, status) {
    const u = requireUser(ctx, 'patient', 'clinician');
    const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(ctx.params.id));
    if (!a || (a.patient_id !== u.id && a.clinician_id !== u.id)) throw new HttpError(404, 'Appointment not found');
    if (a.status !== 'confirmed') throw new HttpError(409, `Appointment is already ${a.status}`);
    if (status === 'completed' && u.id !== a.clinician_id) throw new HttpError(403, 'Only the clinician can mark an appointment completed');
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, a.id);
    if (status === 'cancelled') {
      const other = db.prepare('SELECT email, name FROM users WHERE id = ?').get(u.id === a.clinician_id ? a.patient_id : a.clinician_id);
      const tz = db.prepare('SELECT timezone FROM clinician_profiles WHERE user_id = ?').get(a.clinician_id).timezone;
      await sendMail(db, { to: other.email, subject: 'Appointment cancelled', text: `Hello ${other.name},\n\nThe appointment on ${fmt(a.start_utc, tz)} was cancelled by ${u.name}.\n\nYou can book another time at ${config.appUrl}\n` });
    }
    return { ok: true, status };
  }
  route('POST', '/api/appointments/:id/cancel', (ctx) => changeStatus(ctx, 'cancelled'));
  route('POST', '/api/appointments/:id/complete', (ctx) => changeStatus(ctx, 'completed'));

  // ----- clinician self-service -----
  route('GET', '/api/clinician/profile', (ctx) => {
    const u = requireUser(ctx, 'clinician');
    const row = clinicianRows({ onlyVisible: false, id: u.id })[0];
    const p = db.prepare('SELECT license_no, verified, accepting FROM clinician_profiles WHERE user_id = ?').get(u.id);
    const windows = db.prepare('SELECT weekday, start_time AS start, end_time AS end FROM availability WHERE clinician_id = ? ORDER BY weekday, start_time').all(u.id);
    return { profile: { ...toPublic(row), licenseNo: p.license_no, verified: !!p.verified, accepting: !!p.accepting }, availability: windows };
  });
  route('PUT', '/api/clinician/profile', (ctx) => {
    const u = requireUser(ctx, 'clinician');
    const p = validateProfile(ctx.body, { requireLicense: true });
    db.prepare(`UPDATE clinician_profiles SET profession=?, bio=?, focus=?, languages=?, license_no=?, timezone=?, session_minutes=?, price_eur=?, accepting=? WHERE user_id=?`)
      .run(p.profession, p.bio, JSON.stringify(p.focus), JSON.stringify(p.languages), p.licenseNo, p.timezone, p.sessionMinutes, p.priceEur, ctx.body.accepting === false ? 0 : 1, u.id);
    if (typeof ctx.body.name === 'string' && ctx.body.name.trim()) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(str(ctx.body.name, 100, 'name'), u.id);
    return { ok: true };
  });
  route('PUT', '/api/clinician/availability', (ctx) => {
    const u = requireUser(ctx, 'clinician');
    const windows = Array.isArray(ctx.body.windows) ? ctx.body.windows : null;
    if (!windows || windows.length > 70) throw new HttpError(400, 'windows must be an array (max 70)');
    for (const w of windows) {
      if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6 || !validTime(w.start) || !validTime(w.end) || toMin(w.start) >= toMin(w.end)) throw new HttpError(400, 'Each window needs weekday 0-6 and start < end as HH:MM');
    }
    for (let d = 0; d < 7; d++) {
      const day = windows.filter((w) => w.weekday === d).sort((a, b) => toMin(a.start) - toMin(b.start));
      for (let i = 1; i < day.length; i++) if (toMin(day[i].start) < toMin(day[i - 1].end)) throw new HttpError(400, 'Availability windows on the same day must not overlap');
    }
    tx(db, () => {
      db.prepare('DELETE FROM availability WHERE clinician_id = ?').run(u.id);
      const ins = db.prepare('INSERT INTO availability (clinician_id, weekday, start_time, end_time) VALUES (?,?,?,?)');
      for (const w of windows) ins.run(u.id, w.weekday, w.start, w.end);
    });
    return { ok: true, count: windows.length };
  });

  // ----- content -----
  route('GET', '/api/guides', () => GUIDES);
  route('GET', '/api/medicines', () => MEDICINES);

  // ----- my data (GDPR: access, portability, erasure) -----
  function collectMyData(u) {
    return {
      account: publicUser(u) && { ...publicUser(u), createdAt: u.created_at },
      screenings: db.prepare('SELECT id, score, category, severity, matches, source, created_at AS createdAt FROM screenings WHERE user_id = ? ORDER BY id DESC').all(u.id).map((s) => ({ ...s, matches: j(s.matches, []) })),
      appointments: db.prepare(`SELECT a.id, a.start_utc AS startUtc, a.status, a.reason, a.shared_summary AS sharedSummary, c.name AS clinician FROM appointments a JOIN users c ON c.id = a.clinician_id WHERE a.patient_id = ? ORDER BY a.start_utc DESC`).all(u.id),
      chat: db.prepare('SELECT role, text, created_at AS createdAt FROM chat_messages WHERE user_id = ? ORDER BY id').all(u.id),
    };
  }
  route('GET', '/api/me/data', (ctx) => collectMyData(requireUser(ctx, 'patient', 'clinician', 'admin')));
  route('GET', '/api/me/export', (ctx) => ({ status: 200, headers: { 'Content-Disposition': 'attachment; filename="mindsight-my-data.json"' }, data: collectMyData(requireUser(ctx)) }));
  route('PATCH', '/api/me', (ctx) => {
    const u = requireUser(ctx);
    if (typeof ctx.body.researchConsent === 'boolean') db.prepare('UPDATE users SET research_consent = ? WHERE id = ?').run(ctx.body.researchConsent ? 1 : 0, u.id);
    if (typeof ctx.body.name === 'string' && ctx.body.name.trim()) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(str(ctx.body.name, 100, 'name'), u.id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) };
  });
  route('DELETE', '/api/me/chat', (ctx) => { const u = requireUser(ctx); db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(u.id); return { ok: true }; });
  route('DELETE', '/api/me', async (ctx) => {
    const u = requireUser(ctx);
    if (u.role === 'admin') throw new HttpError(403, 'Admin accounts cannot be self-deleted');
    if (!auth.verifyPassword(String(ctx.body.password || ''), u.password_hash)) throw new HttpError(401, 'Password is incorrect');
    const upcoming = db.prepare(`SELECT a.start_utc, p.email, p.name FROM appointments a JOIN users p ON p.id = a.patient_id WHERE a.clinician_id = ? AND a.status = 'confirmed' AND a.start_utc > ?`).all(u.id, new Date().toISOString());
    for (const a of upcoming) await sendMail(db, { to: a.email, subject: 'Appointment cancelled', text: `Hello ${a.name},\n\nYour appointment on ${a.start_utc} was cancelled because the clinician left the platform. Please book another time.\n` });
    const others = db.prepare(`SELECT c.email, c.name, a.start_utc FROM appointments a JOIN users c ON c.id = a.clinician_id WHERE a.patient_id = ? AND a.status = 'confirmed' AND a.start_utc > ?`).all(u.id, new Date().toISOString());
    for (const a of others) await sendMail(db, { to: a.email, subject: 'Appointment cancelled', text: `Hello ${a.name},\n\nThe patient cancelled the appointment on ${a.start_utc} (account deleted).\n` });
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id); // cascades to all personal data
    return { headers: { 'Set-Cookie': auth.sessionCookie('', 0) }, data: { ok: true } };
  });

  // ----- admin -----
  route('GET', '/api/admin/clinicians', (ctx) => {
    requireUser(ctx, 'admin');
    return { clinicians: db.prepare(`SELECT u.id, u.name, u.email, p.profession, p.license_no AS licenseNo, p.verified, p.is_demo AS isDemo, u.created_at AS createdAt FROM users u JOIN clinician_profiles p ON p.user_id = u.id ORDER BY p.verified, u.id DESC`).all().map((r) => ({ ...r, verified: !!r.verified, isDemo: !!r.isDemo })) };
  });
  route('POST', '/api/admin/clinicians/:id/verify', async (ctx) => {
    requireUser(ctx, 'admin');
    const id = Number(ctx.params.id);
    const verified = ctx.body.verified !== false;
    const r = db.prepare('UPDATE clinician_profiles SET verified = ? WHERE user_id = ?').run(verified ? 1 : 0, id);
    if (!r.changes) throw new HttpError(404, 'Clinician not found');
    const c = db.prepare('SELECT email, name FROM users WHERE id = ?').get(id);
    if (verified) await sendMail(db, { to: c.email, subject: 'You are now verified on MindSight', text: `Hello ${c.name},\n\nYour registration has been verified. Patients can now find you once you have set your availability.\n${config.appUrl}\n` });
    return { ok: true, verified };
  });

  // ----- dev only -----
  if (!config.isProd) route('GET', '/api/dev/outbox', () => ({ emails: db.prepare('SELECT id, to_addr AS "to", intended_to AS intendedTo, subject, body, status, created_at AS createdAt FROM email_outbox ORDER BY id DESC LIMIT 50').all() }));

  // ---------- dispatcher ----------
  function serveStatic(req, res) {
    if (!fs.existsSync(buildDir)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Frontend not built. Run `npm run build` (or use `npm start` on port 3000 in development).'); }
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(buildDir, path.normalize(urlPath));
    if (!file.startsWith(buildDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, 'index.html'); // SPA fallback
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json' };
    const cache = /\.(js|css)$/.test(file) && file.includes(`${path.sep}static${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  }

  return async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    try {
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new HttpError(404, 'Not found');
      const params = url.pathname.match(r.re).groups || {};
      const body = await readJson(req);
      const payload = auth.verifyToken(auth.readCookie(req));
      const user = payload ? db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) : null;
      const ctx = { req, res, body, params, query: url.searchParams, user, ip: req.socket.remoteAddress || 'x' };
      const out = await r.handler(ctx);
      if (out && out.data !== undefined) send(res, out.status || 200, out.data, out.headers);
      else send(res, 200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error('[error]', req.method, req.url, e);
      send(res, 500, { error: 'Something went wrong on our side' });
    }
  };
}

module.exports = { createApp };
