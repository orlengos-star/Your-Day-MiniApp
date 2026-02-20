const TelegramBot = require('node-telegram-bot-api');
const { db, upsertUser } = require('./db');

let bot = null;

function getBot() {
    return bot;
}

function initBot(miniAppUrl) {
    if (!process.env.BOT_TOKEN) {
        console.warn('⚠️  BOT_TOKEN not set — bot will not start');
        return null;
    }

    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

    // ── /start command (handles invite token deep links) ─────────────────────
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
        const token = match[1]?.trim();

        const user = upsertUser(telegramId, name);

        if (token) {
            // Handle invite token
            const invite = db.prepare(
                "SELECT * FROM invite_tokens WHERE token = ? AND usedAt IS NULL AND expiresAt > datetime('now')"
            ).get(token);

            if (!invite) {
                return bot.sendMessage(chatId, '❌ This invite link is invalid or has expired.');
            }

            const inviter = db.prepare('SELECT * FROM users WHERE id = ?').get(invite.inviterId);
            if (!inviter) {
                return bot.sendMessage(chatId, '❌ Invite is no longer valid.');
            }

            if (invite.inviterId === user.id) {
                return bot.sendMessage(chatId, '⚠️ You cannot accept your own invite.');
            }

            // Check if relationship already exists
            let clientId, therapistId;
            if (invite.inviteType === 'invite_therapist') {
                clientId = invite.inviterId;
                therapistId = user.id;
                // Promote accepting user to therapist if needed
                db.prepare('UPDATE users SET role = "therapist" WHERE id = ?').run(user.id);
            } else {
                clientId = user.id;
                therapistId = invite.inviterId;
            }

            const existing = db.prepare(
                'SELECT id FROM relationships WHERE clientId = ? AND therapistId = ?'
            ).get(clientId, therapistId);

            if (existing) {
                return bot.sendMessage(chatId, '✅ You are already connected!');
            }

            db.prepare('INSERT INTO relationships (clientId, therapistId) VALUES (?, ?)').run(clientId, therapistId);
            db.prepare("UPDATE invite_tokens SET usedAt = datetime('now') WHERE id = ?").run(invite.id);

            const role = invite.inviteType === 'invite_therapist' ? 'therapist' : 'client';
            bot.sendMessage(chatId,
                `✅ Connected! You are now ${role === 'therapist' ? 'the therapist for' : 'a client of'} *${inviter.name}*.\n\nOpen your journal below 👇`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{
                            text: '📖 Open Journal',
                            web_app: { url: miniAppUrl }
                        }]]
                    }
                }
            );
            return;
        }

        // Normal /start — welcome message
        bot.sendMessage(chatId,
            `👋 Hello, *${name}*! Welcome to your Emotional Journal.\n\nSend me any message and I'll save it as a journal entry. Or open your journal directly:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{
                        text: '📖 Open Journal',
                        web_app: { url: miniAppUrl }
                    }]]
                }
            }
        );
    });

    // ── All other text messages → save as journal entry ───────────────────────
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

        const user = upsertUser(telegramId, name);

        const today = new Date().toISOString().split('T')[0];
        const result = db.prepare(
            'INSERT INTO journal_entries (userId, text, entryDate) VALUES (?, ?, ?)'
        ).run(user.id, msg.text, today);

        const entryId = result.lastInsertRowid;
        const dateLabel = new Date().toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        bot.sendMessage(chatId,
            `✅ Saved for *${dateLabel}*`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{
                        text: '📖 View entry',
                        web_app: { url: `${miniAppUrl}?startapp=entry_${entryId}` }
                    }]]
                }
            }
        );

        // Notify connected therapists who have per_client notifications enabled
        const therapists = db.prepare(`
      SELECT u.telegramId, ns.therapistMode
      FROM relationships r
      JOIN users u ON u.id = r.therapistId
      LEFT JOIN notification_settings ns ON ns.userId = r.therapistId
      WHERE r.clientId = ?
    `).all(user.id);

        for (const therapist of therapists) {
            if (therapist.therapistMode === 'per_client' || !therapist.therapistMode) {
                const settings = db.prepare(
                    'SELECT enabled FROM notification_settings WHERE userId = (SELECT id FROM users WHERE telegramId = ?)'
                ).get(therapist.telegramId);
                if (settings && !settings.enabled) continue;

                bot.sendMessage(therapist.telegramId,
                    `📝 *${name}* just added a new journal entry.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[{
                                text: '👁 View entry',
                                web_app: { url: `${miniAppUrl}?startapp=entry_${entryId}` }
                            }]]
                        }
                    }
                ).catch(() => { }); // Don't crash if therapist hasn't started the bot
            }
        }
    });

    bot.on('polling_error', (err) => {
        console.error('Bot polling error:', err.message);
    });

    console.log('🤖 Telegram bot started');
    return bot;
}

module.exports = { initBot, getBot };
