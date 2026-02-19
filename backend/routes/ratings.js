const express = require('express');
const router = express.Router();
const { db, upsertUser } = require('../db');

function getDbUser(req) {
    const tu = req.telegramUser;
    const name = [tu.first_name, tu.last_name].filter(Boolean).join(' ');
    return upsertUser(String(tu.id), name);
}

function isTherapistOfClient(therapistDbId, clientDbId) {
    return db.prepare(
        'SELECT id FROM relationships WHERE therapistId = ? AND clientId = ?'
    ).get(therapistDbId, clientDbId);
}

// GET /api/ratings?month=YYYY-MM&clientId=123
router.get('/', (req, res) => {
    const user = getDbUser(req);
    const { month, clientId } = req.query;

    let targetUserId = user.id;
    let isTherapist = false;

    if (clientId) {
        const clientIdInt = parseInt(clientId, 10);
        if (!isTherapistOfClient(user.id, clientIdInt)) {
            return res.status(403).json({ error: 'Not connected to this client' });
        }
        targetUserId = clientIdInt;
        isTherapist = true;
    }

    let ratings;
    if (month) {
        ratings = db.prepare(
            'SELECT * FROM day_ratings WHERE userId = ? AND date LIKE ? ORDER BY date'
        ).all(targetUserId, `${month}%`);
    } else {
        ratings = db.prepare(
            'SELECT * FROM day_ratings WHERE userId = ? ORDER BY date DESC LIMIT 60'
        ).all(targetUserId);
    }

    // Hide therapist ratings from clients
    if (!isTherapist && user.role === 'client') {
        ratings = ratings.map(r => ({ ...r, therapistRating: undefined }));
    }

    res.json(ratings);
});

// POST /api/ratings — upsert a rating for a date
router.post('/', (req, res) => {
    const user = getDbUser(req);
    const { date, clientRating, therapistRating, clientId } = req.body;

    if (!date) return res.status(400).json({ error: 'date is required' });

    let targetUserId = user.id;

    if (clientId) {
        const clientIdInt = parseInt(clientId, 10);
        if (!isTherapistOfClient(user.id, clientIdInt)) {
            return res.status(403).json({ error: 'Not connected to this client' });
        }
        targetUserId = clientIdInt;
    }

    // Clients can only set clientRating; therapists can only set therapistRating
    const isTherapist = clientId !== undefined;

    if (!isTherapist && clientRating !== undefined) {
        if (clientRating < 1 || clientRating > 5) {
            return res.status(400).json({ error: 'clientRating must be 1–5' });
        }
        db.prepare(`
      INSERT INTO day_ratings (userId, date, clientRating)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, date) DO UPDATE SET clientRating = excluded.clientRating
    `).run(targetUserId, date, clientRating);
    }

    if (isTherapist && therapistRating !== undefined) {
        if (therapistRating < 1 || therapistRating > 5) {
            return res.status(400).json({ error: 'therapistRating must be 1–5' });
        }
        db.prepare(`
      INSERT INTO day_ratings (userId, date, therapistRating)
      VALUES (?, ?, ?)
      ON CONFLICT(userId, date) DO UPDATE SET therapistRating = excluded.therapistRating
    `).run(targetUserId, date, therapistRating);
    }

    const rating = db.prepare(
        'SELECT * FROM day_ratings WHERE userId = ? AND date = ?'
    ).get(targetUserId, date);

    res.json(rating);
});

module.exports = router;
