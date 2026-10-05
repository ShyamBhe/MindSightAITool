'use strict';
const fs = require('fs');
const path = require('path');

// Minimal .env loader (no dependency). Real environment variables win.
(function loadEnv() {
  const file = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET === 'change-me')) {
  throw new Error('JWT_SECRET must be set to a long random value in production.');
}

module.exports = {
  isProd,
  port: Number(env.PORT || 4000),
  appUrl: env.APP_URL || 'http://localhost:3000',
  jwtSecret: env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex'),
  dbFile: env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'mindsight.db'),
  gemini: {
    key: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
    baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    timeoutMs: Number(env.GEMINI_TIMEOUT_MS || 12000),
  },
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    secure: bool(env.SMTP_SECURE, false),
    from: env.MAIL_FROM || 'MindSight <no-reply@mindsight.test>',
  },
  demoEmailRedirect: env.DEMO_EMAIL_REDIRECT || '',
  seedDemo: bool(env.SEED_DEMO, !isProd),
  autoVerifyClinicians: bool(env.AUTO_VERIFY_CLINICIANS, !isProd),
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  crisisCountry: env.CRISIS_COUNTRY || 'FI',
};
