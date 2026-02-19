// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    try { require('./.env.js'); } catch { }
    // Simple manual .env loader
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const [key, ...rest] = line.split('=');
            if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
        }
    }
}

const express = require('express');
const cors = require('cors');
const path = require('path');

const { validateInitData } = require('./auth');
const { initBot } = require('./bot');
const { initScheduler } = require('./scheduler');

const entriesRouter = require('./routes/entries');
const ratingsRouter = require('./routes/ratings');
const relationshipsRouter = require('./routes/relationships');
const notificationsRouter = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;
const MINI_APP_URL = process.env.MINI_APP_URL || `http://localhost:${PORT}`;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
    origin: '*', // Telegram WebView can come from various origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'x-dev-user']
}));

app.use(express.json());

// ── API Routes (protected by Telegram initData auth) ─────────────────────────

app.use('/api', validateInitData);
app.use('/api/entries', entriesRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/notifications', notificationsRouter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Serve React frontend (built files) ───────────────────────────────────────

const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

// SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
    const indexPath = path.join(FRONTEND_DIST, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h2>🌿 Emotional Journal</h2>
        <p>Backend is running. Build the frontend with <code>cd frontend && npm run build</code></p>
        <p><a href="/health">Health check</a></p>
      </body></html>
    `);
    }
});

// ── Start server ──────────────────────────────────────────────────────────────

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 Emotional Journal server running on port ${PORT}`);
    console.log(`📱 Mini App URL: ${MINI_APP_URL}`);

    try {
        const bot = initBot(MINI_APP_URL);
        if (bot) {
            initScheduler(bot);
            console.log('🤖 Bot and Scheduler initialized successfully');
        }
    } catch (err) {
        console.error('❌ Failed to initialize bot/scheduler:', err);
        // We don't exit(1) here to allow the web server (and healthcheck) to stay up
    }
});

server.on('error', (err) => {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
});

module.exports = app;
