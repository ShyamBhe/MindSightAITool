'use strict';
const config = require('./config');

let transporter = null;
let smtpTried = false;
function getTransport() {
  if (smtpTried) return transporter;
  smtpTried = true;
  if (!config.smtp.host) return null;
  try {
    const nodemailer = require('nodemailer'); // optional dependency: `npm i nodemailer`
    transporter = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  } catch (e) {
    console.warn('[mail] SMTP_HOST is set but nodemailer is not installed. Run `npm i nodemailer`. Emails will only be logged.');
  }
  return transporter;
}

/**
 * Always records the email in the outbox table (audit + dev inspection). Sends via SMTP if configured.
 * Never throws: a mail failure must not break a booking.
 * DEMO_EMAIL_REDIRECT sends everything to one inbox (subject shows the intended recipient).
 */
async function sendMail(db, { to, subject, text }) {
  const redirect = config.demoEmailRedirect;
  const actualTo = redirect || to;
  const finalSubject = redirect ? `[demo → ${to}] ${subject}` : subject;
  let status = 'logged', error = null;
  const t = getTransport();
  if (t) {
    try { await t.sendMail({ from: config.smtp.from, to: actualTo, subject: finalSubject, text }); status = 'sent'; }
    catch (e) { status = 'failed'; error = String(e.message || e).slice(0, 500); console.error('[mail] send failed:', error); }
  } else if (!config.isProd) {
    console.log(`[mail:logged] to=${actualTo}${redirect ? ` (intended ${to})` : ''} subject="${finalSubject}"`);
  }
  db.prepare('INSERT INTO email_outbox (to_addr, intended_to, subject, body, status, error) VALUES (?,?,?,?,?,?)')
    .run(actualTo, to, finalSubject, text, status, error);
  return status;
}
module.exports = { sendMail };
