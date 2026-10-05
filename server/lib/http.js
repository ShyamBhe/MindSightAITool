'use strict';
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function readJson(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return resolve({});
    // Requiring JSON content-type means a cross-site <form> post can't forge requests (CSRF defence together with SameSite cookies).
    if (!/application\/json/i.test(req.headers['content-type'] || '')) return reject(new HttpError(415, 'Content-Type must be application/json'));
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

// Tiny in-memory fixed-window rate limiter (single-process; use Redis if you scale out).
function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const e = hits.get(key);
    if (!e || now - e.start > windowMs) { hits.set(key, { start: now, n: 1 }); return true; }
    e.n += 1;
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    return e.n <= max;
  };
}

module.exports = { HttpError, readJson, send, rateLimiter };
