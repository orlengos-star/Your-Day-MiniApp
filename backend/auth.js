const crypto = require('crypto');

/**
 * Validates Telegram Mini App initData using HMAC-SHA256.
 * Attaches req.telegramUser on success.
 */
function validateInitData(req, res, next) {
    // In development, allow a bypass header for local testing
    if (process.env.NODE_ENV === 'development' && req.headers['x-dev-user']) {
        try {
            req.telegramUser = JSON.parse(req.headers['x-dev-user']);
            return next();
        } catch {
            return res.status(400).json({ error: 'Invalid x-dev-user header' });
        }
    }

    const initData = req.headers['x-telegram-init-data'];
    if (!initData) {
        return res.status(401).json({ error: 'Missing Telegram initData' });
    }

    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return res.status(401).json({ error: 'Missing hash in initData' });

        // Build the data-check string (all params except hash, sorted)
        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        // HMAC-SHA256 with key = HMAC-SHA256("WebAppData", BOT_TOKEN)
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(process.env.BOT_TOKEN)
            .digest();

        const expectedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (expectedHash !== hash) {
            return res.status(401).json({ error: 'Invalid initData signature' });
        }

        // Check expiry (initData is valid for 24 hours)
        const authDate = parseInt(params.get('auth_date'), 10);
        if (Date.now() / 1000 - authDate > 86400) {
            return res.status(401).json({ error: 'initData expired' });
        }

        const userParam = params.get('user');
        if (!userParam) return res.status(401).json({ error: 'No user in initData' });

        req.telegramUser = JSON.parse(userParam);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'initData validation failed' });
    }
}

module.exports = { validateInitData };
