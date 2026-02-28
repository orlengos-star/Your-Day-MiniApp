const TelegramBot = require('node-telegram-bot-api');
const { db, upsertUser } = require('./db');

let bot = null;
let globalMiniAppUrl = '';

function getBot() {
    return bot;
}

function initBot(miniAppUrl) {
    globalMiniAppUrl = miniAppUrl;

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

            // Check if relationship already exists
            const existing = db.prepare(
                'SELECT id FROM relationships WHERE clientId = ? AND therapistId = ?'
            ).get(invite.inviteType === 'invite_therapist' ? invite.inviterId : user.id,
                invite.inviteType === 'invite_therapist' ? user.id : invite.inviterId);

            if (existing) {
                return bot.sendMessage(chatId, '✅ You are already connected!');
            }

            if (invite.inviterId === user.id) {
                return bot.sendMessage(chatId, '⚠️ You cannot accept your own invite.');
            }

            // Set role and complete onboarding
            let role, welcomeMsg;
            if (invite.inviteType === 'invite_therapist') {
                role = 'therapist';
                db.prepare("UPDATE users SET role = 'therapist', onboardingStatus = 'completed' WHERE id = ?").run(user.id);
                welcomeMsg = `✅ Connected! You are now the therapist for *${inviter.name}*.\n\nOpen your journal below 👇`;
            } else {
                role = 'client';
                db.prepare("UPDATE users SET role = 'client', onboardingStatus = 'completed' WHERE id = ?").run(user.id);
                welcomeMsg = `👋 Hello, *${name}*!\n\nYou have been invited by your therapist, *${inviter.name}*, to use the Emotional Journal. 🌿\n\nThis app is designed to help you track your daily emotions, which can be shared with your therapist during your sessions.\n\nOpen your journal below to get started:`;
            }

            db.prepare('INSERT INTO relationships (clientId, therapistId) VALUES (?, ?)').run(
                role === 'client' ? user.id : inviter.id,
                role === 'therapist' ? user.id : inviter.id
            );
            db.prepare("UPDATE invite_tokens SET usedAt = datetime('now') WHERE id = ?").run(invite.id);

            bot.sendMessage(chatId, welcomeMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{
                        text: '📖 Open Journal',
                        web_app: { url: miniAppUrl }
                    }]]
                }
            });
            return;
        }

        // Normal /start - Check onboarding status
        if (user.onboardingStatus === 'pending_role') {
            return bot.sendMessage(chatId,
                `👋 Hello, *${name}*! Welcome to your Emotional Journal.\n\nBefore we begin, how do you plan to use this app?`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🧠 I am a Professional (Therapist)', callback_data: 'role_therapist' }],
                            [{ text: '📝 I am using it for my Personal diary', callback_data: 'role_client' }]
                        ]
                    }
                }
            );
        }

        // Normal /start — welcome message
        bot.sendMessage(chatId,
            `👋 Hello, *${name}*! Welcome back to your Emotional Journal.\n\nSend me any message and I'll save it as a journal entry. Or open your journal directly:`,
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

    // Handle role selection callbacks
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = String(query.from.id);
        const data = query.data;

        if (data.startsWith('role_')) {
            const role = data === 'role_therapist' ? 'therapist' : 'client';
            db.prepare("UPDATE users SET role = ?, onboardingStatus = 'completed' WHERE telegramId = ?")
                .run(role, telegramId);

            const msg = role === 'therapist'
                ? "✅ Professional mode activated. You can now invite clients and manage their journals."
                : "✅ Personal mode activated. Send me any message to start your diary!";

            bot.answerCallbackQuery(query.id);
            bot.editMessageText(msg + "\n\n👇 Open your app below:", {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [[{
                        text: '📖 Open Journal',
                        web_app: { url: miniAppUrl }
                    }]]
                }
            });
        }
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

        notifyTherapistsOfNewEntry(user.id, name, entryId);
    });

    bot.on('polling_error', (err) => {
        console.error('Bot polling error:', err.message);
    });

    console.log('🤖 Telegram bot started');
    return bot;
}

function notifyTherapistsOfNewEntry(userId, userName, entryId) {
    if (!bot) return;

    const therapists = db.prepare(`
      SELECT u.telegramId, ns.therapistMode
      FROM relationships r
      JOIN users u ON u.id = r.therapistId
      LEFT JOIN notification_settings ns ON ns.userId = r.therapistId
      WHERE r.clientId = ?
    `).all(userId);

    for (const therapist of therapists) {
        if (therapist.therapistMode === 'per_client' || !therapist.therapistMode) {
            const settings = db.prepare(
                'SELECT enabled FROM notification_settings WHERE userId = (SELECT id FROM users WHERE telegramId = ?)'
            ).get(therapist.telegramId);
            if (settings && !settings.enabled) continue;

            bot.sendMessage(therapist.telegramId,
                `📝 *${userName}* just added a new journal entry.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{
                            text: '👁 View entry',
                            web_app: { url: `${globalMiniAppUrl}?startapp=entry_${entryId}` }
                        }]]
                    }
                }
            ).catch(() => { }); // Don't crash if therapist hasn't started the bot
        }
    }
}

module.exports = { initBot, getBot, notifyTherapistsOfNewEntry };
