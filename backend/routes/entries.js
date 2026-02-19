const express = require('express');
const router = express.Router();
const { db, upsertUser } = require('../db');

// Helper: get db user from req.telegramUser
function getDbUser(req) {
    const tu = req.telegramUser;
    const name = [tu.first_name, tu.last_name].filter(Boolean).join(' ');
    return upsertUser(String(tu.id), name);
}

// Helper: check if therapist is connected to a client
function isTherapistOfClient(therapistDbId, clientDbId) {
    return db.prepare(
        'SELECT id FROM relationships WHERE therapistId = ? AND clientId = ?'
    ).get(therapistDbId, clientDbId);
}

// GET /api/entries?month=YYYY-MM&clientId=123
router.get('/', (req, res) => {
    const user = getDbUser(req);
    const { month, clientId } = req.query;

    let targetUserId = user.id;

    // Therapist viewing a client's entries
    if (clientId) {
        const clientIdInt = parseInt(clientId, 10);
        if (!isTherapistOfClient(user.id, clientIdInt)) {
            return res.status(403).json({ error: 'Not connected to this client' });
        }
        targetUserId = clientIdInt;
    }

    let entries;
    if (month) {
        // month = YYYY-MM
        entries = db.prepare(`
      SELECT * FROM journal_entries
      WHERE userId = ? AND entryDate LIKE ?
      ORDER BY entryDate DESC, createdAt DESC
    `).all(targetUserId, `${month}%`);
    } else {
        entries = db.prepare(`
      SELECT * FROM journal_entries
      WHERE userId = ?
      ORDER BY entryDate DESC, createdAt DESC
      LIMIT 100
    `).all(targetUserId);
    }

    // Hide therapist comments from clients viewing their own entries
    if (targetUserId === user.id && user.role === 'client') {
        entries = entries.map(e => ({ ...e, therapistComments: undefined }));
    }

    res.json(entries);
});

// GET /api/entries/:id
router.get('/:id', (req, res) => {
    const user = getDbUser(req);
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Owner can always see their entry (without therapist comments)
    if (entry.userId === user.id) {
        const safeEntry = user.role === 'client'
            ? { ...entry, therapistComments: undefined }
            : entry;
        return res.json(safeEntry);
    }

    // Therapist can see if connected
    if (user.role === 'therapist' && isTherapistOfClient(user.id, entry.userId)) {
        return res.json(entry);
    }

    return res.status(403).json({ error: 'Access denied' });
});

// POST /api/entries
router.post('/', (req, res) => {
    const user = getDbUser(req);
    const { text, entryDate } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Entry text is required' });
    }

    const date = entryDate || new Date().toISOString().split('T')[0];
    const result = db.prepare(
        'INSERT INTO journal_entries (userId, text, entryDate) VALUES (?, ?, ?)'
    ).run(user.id, text.trim(), date);

    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(entry);
});

// PUT /api/entries/:id
router.put('/:id', (req, res) => {
    const user = getDbUser(req);
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const isOwner = entry.userId === user.id;
    const isTherapist = user.role === 'therapist' && isTherapistOfClient(user.id, entry.userId);

    if (!isOwner && !isTherapist) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { text, therapistComments, isHighlighted } = req.body;

    if (isOwner && text !== undefined) {
        db.prepare(
            'UPDATE journal_entries SET text = ?, updatedAt = datetime("now") WHERE id = ?'
        ).run(text.trim(), entry.id);
    }

    if (isTherapist) {
        if (therapistComments !== undefined) {
            db.prepare(
                'UPDATE journal_entries SET therapistComments = ?, updatedAt = datetime("now") WHERE id = ?'
            ).run(therapistComments, entry.id);
        }
        if (isHighlighted !== undefined) {
            db.prepare(
                'UPDATE journal_entries SET isHighlighted = ?, updatedAt = datetime("now") WHERE id = ?'
            ).run(isHighlighted ? 1 : 0, entry.id);
        }
    }

    const updated = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entry.id);
    res.json(updated);
});

// DELETE /api/entries/:id
router.delete('/:id', (req, res) => {
    const user = getDbUser(req);
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.userId !== user.id) return res.status(403).json({ error: 'Only the owner can delete entries' });

    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(entry.id);
    res.json({ success: true });
});

module.exports = router;
