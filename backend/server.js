const express = require('express');
const cors = require('cors');
const path = require('path');

// NOTE: Railway sets NODE_ENV to 'production', so the manual .env loader below 
// is skipped on Railway. Make sure you set variables in the Railway Dashboard!
if (process.env.NODE_ENV !== 'production') {
    try { require('./.env.js'); } catch { }
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

// ── FIXED: Health check MOVED TO TOP ──────────────────────────────────────────
// This ensures it runs even if other middleware fails
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'x-dev-user']
}));

app.use(express.json());

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api', validateInitData);
app.use('/api/entries', entriesRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/notifications', notificationsRouter);

// ── Serve React frontend ─────────────────────────────────────────────────────

const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

// SPA fallback
app.get('*', (req, res) => {
    const indexPath = path.join(FRONTEND_DIST, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h2>🌿 Emotional Journal</h2>
        <p>Backend is running. Frontend not found (did the build script run?)</p>
        <p><a href="/health">Health check</a></p>
      </body></html>
    `);
    }
});

// ── FIXED: Start server with '0.0.0.0' ───────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 Emotional Journal server running on http://0.0.0.0:${PORT}`);
    console.log(`📱 Mini App URL: ${MINI_APP_URL}`);

    // WRAPPER: Try/Catch added to prevent Bot failure from crashing the whole server
    try {
        const bot = initBot(MINI_APP_URL);
        if (bot) initScheduler(bot);
    } catch (error) {
        console.error("⚠️ Bot failed to start (Check your .env variables in Railway):", error.message);
    }
});

module.exports = app;
