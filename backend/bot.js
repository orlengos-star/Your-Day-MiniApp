const TelegramBot = require('node-telegram-bot-api');
const { db, upsertUser } = require('./db');

let bot = null;
let globalMiniAppUrl = '';

function getBot() {
    return bot;
}

// ── Sticky Message Helpers ────────────────────────────────────────────────────

/**
 * Delete a user's incoming message silently (best-effort).
 */
function deleteUserMessage(chatId, messageId) {
    if (!bot || !messageId) return;
    bot.deleteMessage(chatId, messageId).catch(() => { });
}

/**
 * Save the latest sticky message ID for a user in the DB.
 */
function saveLastMessageId(telegramId, messageId) {
    db.prepare('UPDATE users SET lastMessageId = ? WHERE telegramId = ?').run(messageId, String(telegramId));
}

/**
 * Delete the old sticky message for a user (best-effort).
 */
function clearOldStickyMessage(chatId, oldMessageId) {
    if (!bot || !oldMessageId) return;
    bot.deleteMessage(chatId, oldMessageId).catch(() => { });
}

/**
 * Send the standard "Open App" sticky menu.
 * - If silent=true:  edits the existing sticky message (no push notification)
 * - If silent=false: sends a NEW message (triggers notification), deletes the old one
 */
async function sendStickyMenu(chatId, telegramId, text, options = {}, silent = true) {
    const user = db.prepare('SELECT lastMessageId FROM users WHERE telegramId = ?').get(String(telegramId));
    const oldMessageId = user?.lastMessageId;

    const replyMarkup = options.reply_markup || {
        inline_keyboard: [[{
            text: '📖 Open Journal',
            web_app: { url: globalMiniAppUrl }
        }]]
    };

    if (silent && oldMessageId) {
        // Quiet update: edit in-place, no notification
        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: oldMessageId,
                parse_mode: 'Markdown',
                reply_markup: replyMarkup,
            });
            return; // Success — no need to send a new message
        } catch (err) {
            // If edit fails (e.g. message was deleted by user), fall through to sending new
        }
    }

    // Loud or edit failed: send a NEW message (triggers push notification)
    const sent = await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
        ...options,
    });

    // Delete the OLD sticky message after sending the new one
    clearOldStickyMessage(chatId, oldMessageId);

    // Remember the new message
    saveLastMessageId(telegramId, sent.message_id);
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

        // Delete the /start command message
        deleteUserMessage(chatId, msg.message_id);

        const user = upsertUser(telegramId, name);

        if (token) {
            // Handle invite token
            const invite = db.prepare(
                "SELECT * FROM invite_tokens WHERE token = ? AND usedAt IS NULL AND expiresAt > datetime('now')"
            ).get(token);

            if (!invite) {
                return sendStickyMenu(chatId, telegramId, '❌ This invite link is invalid or has expired.', {}, false);
            }

            const inviter = db.prepare('SELECT * FROM users WHERE id = ?').get(invite.inviterId);
            if (!inviter) {
                return sendStickyMenu(chatId, telegramId, '❌ Invite is no longer valid.', {}, false);
            }

            // Check if relationship already exists
            const existing = db.prepare(
                'SELECT id FROM relationships WHERE clientId = ? AND therapistId = ?'
            ).get(invite.inviteType === 'invite_therapist' ? invite.inviterId : user.id,
                invite.inviteType === 'invite_therapist' ? user.id : invite.inviterId);

            if (existing) {
                return sendStickyMenu(chatId, telegramId, '✅ You are already connected!', {}, false);
            }

            if (invite.inviterId === user.id) {
                return sendStickyMenu(chatId, telegramId, '⚠️ You cannot accept your own invite.', {}, false);
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
                welcomeMsg = `👋 Hello, *${name}*!\n\nYou have been invited by your therapist, *${inviter.name}*, to use the Emotional Journal. 🌊\n\nThis app is designed to help you track your daily emotions, which can be shared with your therapist during your sessions.\n\nOpen your journal below to get started:`;
            }

            db.prepare('INSERT INTO relationships (clientId, therapistId) VALUES (?, ?)').run(
                role === 'client' ? user.id : inviter.id,
                role === 'therapist' ? user.id : inviter.id
            );
            db.prepare("UPDATE invite_tokens SET usedAt = datetime('now') WHERE id = ?").run(invite.id);

            return sendStickyMenu(chatId, telegramId, welcomeMsg, {}, false);
        }

        // Normal /start — check onboarding status
        if (user.onboardingStatus === 'pending_role') {
            return sendStickyMenu(chatId, telegramId,
                `👋 Hello, *${name}*! Welcome to your Emotional Journal.\n\nBefore we begin, how do you plan to use this app?`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🧠 I am a Professional (Therapist)', callback_data: 'role_therapist' }],
                            [{ text: '📝 I am using it for my Personal diary', callback_data: 'role_client' }]
                        ]
                    }
                },
                false // Always loud on first contact
            );
        }

        // Normal /start — welcome back
        sendStickyMenu(chatId, telegramId,
            `👋 Hello, *${name}*! Welcome back.\n\nSend me any message to save a journal entry, or open your journal directly:`,
            {},
            false // Loud: ensure they get notified in case they forgot about the app
        );
    });

    // ── Handle role selection callbacks ──────────────────────────────────────
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
            // Edit the existing onboarding message (it's already sticky at this point)
            bot.editMessageText(msg + "\n\n👇 Open your app below:", {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{
                        text: '📖 Open Journal',
                        web_app: { url: miniAppUrl }
                    }]]
                }
            }).catch(() => { });
        }

        if (data === 'open_journal') {
            bot.answerCallbackQuery(query.id);
        }
    });

    // ── All other text messages → save as journal entry ───────────────────────
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

        // Delete the user's message immediately for a clean chat
        deleteUserMessage(chatId, msg.message_id);

        const user = upsertUser(telegramId, name);

        const today = new Date().toISOString().split('T')[0];
        const result = db.prepare(
            'INSERT INTO journal_entries (userId, text, entryDate) VALUES (?, ?, ?)'
        ).run(user.id, msg.text, today);

        const entryId = result.lastInsertRowid;
        const dateLabel = new Date().toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        // Quietly edit the existing sticky message — no push notification
        sendStickyMenu(chatId, telegramId,
            `✅ Entry saved for *${dateLabel}*.\n\nSend another message to keep writing, or open the journal to see your full day:`,
            {
                reply_markup: {
                    inline_keyboard: [[{
                        text: '📖 View entry',
                        web_app: { url: `${miniAppUrl}?startapp=entry_${entryId}` }
                    }]]
                }
            },
            true // Silent edit
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
      SELECT u.telegramId, u.lastMessageId, ns.therapistMode
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

            // Therapist notifications are always loud (new entry = push notification)
            const chatId = therapist.telegramId;
            const oldMessageId = therapist.lastMessageId;

            bot.sendMessage(chatId,
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
            ).then(sent => {
                clearOldStickyMessage(chatId, oldMessageId);
                saveLastMessageId(therapist.telegramId, sent.message_id);
            }).catch(() => { });
        }
    }
}

module.exports = { initBot, getBot, notifyTherapistsOfNewEntry, sendStickyMenu };
