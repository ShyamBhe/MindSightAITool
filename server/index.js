'use strict';
const http = require('http');
const config = require('./lib/config');
const { open } = require('./lib/db');
const { createApp } = require('./app');
const { seedDemo, ensureAdmin, DEMO_PASSWORD } = require('./seed');

const db = open();
if (config.seedDemo && seedDemo(db)) console.log(`[seed] Demo clinicians created. Password for all demo accounts: ${DEMO_PASSWORD}`);
ensureAdmin(db, config.adminEmail, config.adminPassword);

http.createServer(createApp(db)).listen(config.port, '0.0.0.0', () => {
  console.log(`MindSight API on http://localhost:${config.port}  |  Gemini: ${config.gemini.key ? config.gemini.model : 'OFF (rule-based only)'}  |  SMTP: ${config.smtp.host || 'OFF (emails logged to outbox)'}`);
});


