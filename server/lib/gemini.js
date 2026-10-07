'use strict';
const config = require('./config');
const { CATEGORIES, SEVERITIES } = require('./screening');

const SYSTEM_PROMPT = `You are "MindSight Companion", a warm, calm supportive chat companion inside a mental-health screening app.
You are NOT a doctor and must not diagnose, prescribe, or give medication advice.
Style: 2-5 short sentences, plain language, empathetic, no lists. Ask at most ONE gentle follow-up question. Reply in the language the user writes in.
Never reveal numeric scores or internal categories in "reply".
If the user may be in danger (suicide, self-harm, harming others, abuse), respond with care, encourage contacting emergency services or a crisis line and a trusted person now, and do not argue or minimise.
Also assess the WHOLE conversation so far and return JSON only:
- reply: your message to the user
- categories: array of {category, severity} for concerns you detect. category MUST be one of: ${CATEGORIES.join(', ')}
- severity: overall severity, one of: ${SEVERITIES.join(', ')}
- score: integer 0-100 overall concern level
Use "none" / empty categories if nothing concerning is expressed. Do not over-diagnose from a single mild statement.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    categories: { type: 'ARRAY', items: { type: 'OBJECT', properties: { category: { type: 'STRING', enum: CATEGORIES }, severity: { type: 'STRING', enum: SEVERITIES } }, required: ['category', 'severity'] } },
    severity: { type: 'STRING', enum: SEVERITIES },
    score: { type: 'INTEGER' },
  },
  required: ['reply', 'categories', 'severity', 'score'],
};

// Simple circuit breaker: after 3 consecutive failures skip Gemini for 60 s (fast fallback instead of 12 s waits).
const breaker = { fails: 0, openUntil: 0 };
const last = { ok: null, at: null, error: null, httpStatus: null };

function buildContents(history, message) {
  const turns = [...history, { from: 'user', text: message }].slice(-20);
  const contents = [];
  for (const t of turns) {
    const role = t.from === 'bot' ? 'model' : 'user';
    const text = String(t.text || '').slice(0, 2000);
    if (!text) continue;
    if (contents.length && contents[contents.length - 1].role === role) contents[contents.length - 1].parts[0].text += '\n' + text;
    else contents.push({ role, parts: [{ text }] });
  }
  while (contents.length && contents[0].role !== 'user') contents.shift(); // Gemini requires the first turn to be 'user'
  return contents;
}

function parseModelJson(text) {
  const cleaned = String(text).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(cleaned);
  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
  if (!reply) throw new Error('Empty reply from model');
  const severity = SEVERITIES.includes(obj.severity) ? obj.severity : 'none';
  const categories = (Array.isArray(obj.categories) ? obj.categories : [])
    .filter((c) => c && CATEGORIES.includes(c.category) && SEVERITIES.includes(c.severity))
    .slice(0, 6);
  const score = Math.max(0, Math.min(100, Math.round(Number(obj.score) || 0)));
  return { reply: reply.slice(0, 1500), severity, categories, score };
}

async function callOnce(contents, lang) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.gemini.timeoutMs);
  try {
    const res = await fetch(`${config.gemini.baseUrl}/models/${encodeURIComponent(config.gemini.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + (lang === 'fi' ? '\nThe app language is Finnish: reply in Finnish unless the user clearly writes in another language.' : '') }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 1024, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = new Error(`Gemini HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (data.promptFeedback?.blockReason) throw new Error(`Blocked: ${data.promptFeedback.blockReason}`);
    const cand = data.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text || '').join('');
    if (!text) throw new Error(`No content (finishReason=${cand?.finishReason})`);
    return parseModelJson(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Returns {reply, severity, categories, score}. Throws on any failure; the caller falls back to rules. */
async function chat(history, message, lang) {
  if (!config.gemini.key) throw new Error('GEMINI_API_KEY not configured');
  if (Date.now() < breaker.openUntil) throw new Error('Gemini circuit open');
  const contents = buildContents(history, message);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await callOnce(contents, lang);
      breaker.fails = 0;
      Object.assign(last, { ok: true, at: new Date().toISOString(), error: null, httpStatus: null });
      return out;
    } catch (e) {
      lastErr = e;
      const retryable = e.name === 'AbortError' || e.status === 429 || e.status >= 500 || e instanceof SyntaxError;
      if (!retryable) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  Object.assign(last, { ok: false, at: new Date().toISOString(), error: String(lastErr && lastErr.message || lastErr).slice(0, 200), httpStatus: lastErr && lastErr.status || null });
  if (++breaker.fails >= 3) breaker.openUntil = Date.now() + 60_000;
  throw lastErr;
}

// Safe to expose publicly: never contains the key itself.
const status = () => ({ configured: !!config.gemini.key, keyLength: config.gemini.key.length, keyHasWhitespaceOrQuotes: /[\s"']/.test(config.gemini.key), model: config.gemini.model, circuitOpen: Date.now() < breaker.openUntil, last });
const resetBreaker = () => { breaker.fails = 0; breaker.openUntil = 0; };
module.exports = { status, chat, buildContents, parseModelJson, resetBreaker };
