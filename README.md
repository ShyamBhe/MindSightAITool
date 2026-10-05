# MindSight: AI-assisted mental health companion

Chat → screening → self-help → matched clinicians → booking → email notification to the clinician.

* **Frontend:** React 19 + MUI (Create React App)
* **Backend:** Node.js ≥ 22.13, **zero required runtime dependencies** (built-in `http`, `node:sqlite`, `fetch`, `crypto`). `nodemailer` is optional, for real email.
* **LLM:** Google Gemini, with automatic fallback to the built-in rule engine.

## Quick start

```bash
npm install
cp .env.example .env          # optional for first run; everything works without keys
npm run server                # API on :4000 (creates data/mindsight.db, seeds demo clinicians)
npm start                     # UI on :3000 (proxies /api to :4000)   <- second terminal
```

Open http://localhost:3000. Production: `npm run start:prod` (builds the UI and serves everything from :4000; set `NODE_ENV=production` and a real `JWT_SECRET`).

### Demo accounts (when `SEED_DEMO=true`, the default outside production)
Password for all: `DemoPass123!`

| Role | Email |
|---|---|
| Patient | `demo.patient@mindsight.test` |
| Clinicians (6) | `paavo.salo@`, `amit.patel@`, `lauri.koivunen@`, `sarah.nguyen@`, `jukka.laine@`, `lina.roberts@` + `mindsight.test` |

`*.test` is a reserved domain, so nothing is ever delivered to these addresses. To **receive the notifications in your own inbox** while testing, set `SMTP_*` and `DEMO_EMAIL_REDIRECT=you@yourmail.com`: every email is rerouted to you with the intended recipient in the subject. Without SMTP, emails are logged and visible at `GET /api/dev/outbox` (development only).

## What it does

1. **Chat + Gemini.** `POST /api/chat` sends the conversation to Gemini (structured JSON: reply + categories + severity). The same text is always analysed by the rule engine (`server/data/scoringRules.json`).
2. **Fallback.** If Gemini is missing, slow (12 s timeout), errors, is blocked, or returns invalid JSON → one retry, then the rule engine + templated supportive reply. After 3 consecutive failures Gemini is skipped for 60 s (circuit breaker). The UI tells the user when it is in fallback mode.
3. **Safety net.** Final severity = the *higher* of Gemini and the rules. If critical, a fixed crisis message and crisis numbers are always shown, whatever the LLM said.
4. **Matching.** Clinicians are ranked by focus-area match, profession fit for the severity (e.g. high severity or psychosis/mania → psychiatrists first), real availability, and reviews, with human-readable reasons.
5. **Clinician onboarding.** Clinicians sign up with profession, focus areas, licence number, languages, price, timezone; set weekly availability; manage appointments. They are hidden from patients until an **admin verifies** the licence (set `ADMIN_EMAIL`/`ADMIN_PASSWORD`; `AUTO_VERIFY_CLINICIANS=true` skips this in dev).
6. **Booking.** Slots are generated server-side in the clinician's timezone (DST-safe), validated again on booking, protected against double-booking by a database unique index. Clinician + patient get emails; cancellation notifies the other party. Patients may optionally share a short screening summary (never the chat).
7. **Self-help** (`/api/guides`): separate **Anxiety** and **Depression** guides (+ Sleep, Stress). **Medicines** (`/api/medicines`): educational class-level info, deliberately **no doses**.
8. **Your data:** history, export (JSON), delete chat, delete account (cascades), research-consent switch (off by default).

## Tests
```bash
npm run test:server      # 21 API tests incl. mock-Gemini success / 500 / garbage / breaker / safety override / booking / email
npx react-scripts test --watchAll=false
```

## Before real users: checklist (not done by this code)
* **Legal/privacy:** mental-health data is special-category data under GDPR. You need a privacy policy, a lawful basis/explicit consent, a DPA with Google (use a paid Gemini tier and check its data-use terms) and with your hosting/email providers; consider whether the tool counts as a medical device in your market.
* **Clinical review:** have a clinician review the rules, advice text, self-help guides and especially `server/data/medicines.json`. **Verify crisis numbers** in `server/lib/crisis.js` for every country you serve.
* **Accounts:** email verification and password reset are not implemented. Rate limiting is in-memory (single process).
* **Database:** SQLite is fine for a pilot; move to PostgreSQL and encrypted backups for scale.
* **Not included:** payments, video/chat consultations (booking only), email reminders, calendar (.ics) invites.
* Run behind HTTPS (cookies are `Secure` in production).
