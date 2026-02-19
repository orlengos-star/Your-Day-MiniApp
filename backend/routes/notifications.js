const express = require('express');
const router = express.Router();
const { db, upsertUser, ensureNotificationSettings } = require('../db');

function getDbUser(req) {
    const tu = req.telegramUser;
    const name = [tu.first_name, tu.last_name].filter(Boolean).join(' ');
    return upsertUser(String(tu.id), name);
}

// GET /api/notifications/settings
router.get('/settings', (req, res) => {
    const user = getDbUser(req);
    const settings = ensureNotificationSettings(user.id);
    res.json(settings);
});

// PUT /api/notifications/settings
router.put('/settings', (req, res) => {
    const user = getDbUser(req);
    ensureNotificationSettings(user.id);

    const { enabled, reminderTime, therapistMode, batchTime } = req.body;

    const updates = [];
    const values = [];

    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    if (reminderTime !== undefined) { updates.push('reminderTime = ?'); values.push(reminderTime); }
    if (therapistMode !== undefined) { updates.push('therapistMode = ?'); values.push(therapistMode); }
    if (batchTime !== undefined) { updates.push('batchTime = ?'); values.push(batchTime); }

    if (updates.length > 0) {
        values.push(user.id);
        db.prepare(`UPDATE notification_settings SET ${updates.join(', ')} WHERE userId = ?`).run(...values);
    }

    const settings = db.prepare('SELECT * FROM notification_settings WHERE userId = ?').get(user.id);
    res.json(settings);
});

module.exports = router;
