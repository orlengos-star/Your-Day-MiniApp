const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, upsertUser } = require('../db');

function getDbUser(req) {
    const tu = req.telegramUser;
    const name = [tu.first_name, tu.last_name].filter(Boolean).join(' ');
    return upsertUser(String(tu.id), name);
}

// POST /api/relationships/invite — generate an invite link
router.post('/invite', (req, res) => {
    const user = getDbUser(req);
    const { inviteType } = req.body;

    if (!['invite_therapist', 'invite_client'].includes(inviteType)) {
        return res.status(400).json({ error: 'inviteType must be invite_therapist or invite_client' });
    }

    const token = uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    db.prepare(
        'INSERT INTO invite_tokens (token, inviterId, inviteType, expiresAt) VALUES (?, ?, ?, ?)'
    ).run(token, user.id, inviteType, expiresAt);

    const botUsername = process.env.BOT_USERNAME || 'your_bot';
    const link = `https://t.me/${botUsername}?start=${token}`;

    res.json({ token, link, expiresAt });
});

// GET /api/relationships/invite/:token — preview invite (who sent it)
router.get('/invite/:token', (req, res) => {
    const invite = db.prepare(
        'SELECT * FROM invite_tokens WHERE token = ? AND usedAt IS NULL AND expiresAt > datetime("now")'
    ).get(req.params.token);

    if (!invite) return res.status(404).json({ error: 'Invalid or expired invite' });

    const inviter = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(invite.inviterId);
    res.json({ inviter, inviteType: invite.inviteType, expiresAt: invite.expiresAt });
});

// GET /api/relationships/clients — list therapist's connected clients
router.get('/clients', (req, res) => {
    const user = getDbUser(req);

    if (user.role !== 'therapist') {
        return res.status(403).json({ error: 'Only therapists can list clients' });
    }

    const clients = db.prepare(`
    SELECT u.id, u.name, u.telegramId, r.connectedAt, r.id as relationshipId
    FROM relationships r
    JOIN users u ON u.id = r.clientId
    WHERE r.therapistId = ?
    ORDER BY u.name
  `).all(user.id);

    res.json(clients);
});

// GET /api/relationships/therapist — get the client's connected therapist
router.get('/therapist', (req, res) => {
    const user = getDbUser(req);

    const therapist = db.prepare(`
    SELECT u.id, u.name, r.connectedAt, r.id as relationshipId
    FROM relationships r
    JOIN users u ON u.id = r.therapistId
    WHERE r.clientId = ?
    LIMIT 1
  `).get(user.id);

    res.json(therapist || null);
});

// DELETE /api/relationships/:id — disconnect
router.delete('/:id', (req, res) => {
    const user = getDbUser(req);
    const rel = db.prepare('SELECT * FROM relationships WHERE id = ?').get(req.params.id);

    if (!rel) return res.status(404).json({ error: 'Relationship not found' });

    if (rel.clientId !== user.id && rel.therapistId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.prepare('DELETE FROM relationships WHERE id = ?').run(rel.id);
    res.json({ success: true });
});

module.exports = router;
