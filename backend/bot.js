const TelegramBot = require('node-telegram-bot-api');
const { db, upsertUser } = require('./db');
const { t } = require('./bot_i18n');

let bot = null;
let globalMiniAppUrl = '';

function getBot() {
    return bot;
}

// ── Language helper ───────────────────────────────────────────────────────────

/**
 * Detect user's language from Telegram's language_code field.
 * Defaults to 'ru' for any non-English code.
 */
function detectLang(fromObj) {
    const code = fromObj?.language_code || '';
    return code.startsWith('en') ? 'en' : 'ru';
}

/**
 * Get a user's saved language from the DB, or detect from the message and save it.
 */
function getUserLang(user, fromObj) {
    if (user.lang) return user.lang;
    const lang = detectLang(fromObj);
    db.prepare("UPDATE users SET lang = ? WHERE id = ?").run(lang, user.id);
    return lang;
}

// ── Sticky Message Helpers ────────────────────────────────────────────────────

function deleteUserMessage(chatId, messageId) {
    if (!bot || !messageId) return;
    bot.deleteMessage(chatId, messageId).catch(() => { });
}

function saveLastMessageId(telegramId, messageId) {
    db.prepare('UPDATE users SET lastMessageId = ? WHERE telegramId = ?').run(messageId, String(telegramId));
}

function clearOldStickyMessage(chatId, oldMessageId) {
    if (!bot || !oldMessageId) return;
    bot.deleteMessage(chatId, oldMessageId).catch(() => { });
}

/**
 * Send the standard "Open App" sticky menu.
 * - silent=true:  edits the existing sticky message (no push notification)
 * - silent=false: sends a NEW message (triggers notification), deletes the old one
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
        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: oldMessageId,
                parse_mode: 'Markdown',
                reply_markup: replyMarkup,
            });
            return;
        } catch (err) {
            // Edit failed (message deleted by user) — fall through to sending new
        }
    }

    const sent = await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
        ...options,
    });

    clearOldStickyMessage(chatId, oldMessageId);
    saveLastMessageId(telegramId, sent.message_id);
}

function initBot(miniAppUrl) {
    globalMiniAppUrl = miniAppUrl;

    if (!process.env.BOT_TOKEN) {
        console.warn('⚠️  BOT_TOKEN not set — bot will not start');
        return null;
    }

    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

    // ── /start command ────────────────────────────────────────────────────────
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
        const token = match[1]?.trim();

        deleteUserMessage(chatId, msg.message_id);

        const user = upsertUser(telegramId, name);
        const lang = getUserLang(user, msg.from);
        const s = t(lang);

        if (token) {
            const invite = db.prepare(
                "SELECT * FROM invite_tokens WHERE token = ? AND usedAt IS NULL AND expiresAt > datetime('now')"
            ).get(token);

            if (!invite) return sendStickyMenu(chatId, telegramId, s.invalidInvite, {}, false);

            const inviter = db.prepare('SELECT * FROM users WHERE id = ?').get(invite.inviterId);
            if (!inviter) return sendStickyMenu(chatId, telegramId, s.inviteGone, {}, false);

            const existing = db.prepare(
                'SELECT id FROM relationships WHERE clientId = ? AND therapistId = ?'
            ).get(
                invite.inviteType === 'invite_therapist' ? invite.inviterId : user.id,
                invite.inviteType === 'invite_therapist' ? user.id : invite.inviterId
            );
            if (existing) return sendStickyMenu(chatId, telegramId, s.alreadyConnected, {}, false);
            if (invite.inviterId === user.id) return sendStickyMenu(chatId, telegramId, s.selfInvite, {}, false);

            let role, welcomeMsg;
            if (invite.inviteType === 'invite_therapist') {
                role = 'therapist';
                db.prepare("UPDATE users SET role = 'therapist', onboardingStatus = 'completed' WHERE id = ?").run(user.id);
                welcomeMsg = s.inviteAsTherapist(inviter.name);
            } else {
                role = 'client';
                db.prepare("UPDATE users SET role = 'client', onboardingStatus = 'completed' WHERE id = ?").run(user.id);
                welcomeMsg = s.inviteAsClient(name, inviter.name);
            }

            db.prepare('INSERT INTO relationships (clientId, therapistId) VALUES (?, ?)').run(
                role === 'client' ? user.id : inviter.id,
                role === 'therapist' ? user.id : inviter.id
            );
            db.prepare("UPDATE invite_tokens SET usedAt = datetime('now') WHERE id = ?").run(invite.id);

            return sendStickyMenu(chatId, telegramId, welcomeMsg, {
                reply_markup: {
                    inline_keyboard: [[{ text: s.openJournal, web_app: { url: miniAppUrl } }]]
                }
            }, false);
        }

        // Normal /start — check onboarding
        if (user.onboardingStatus === 'pending_role') {
            return sendStickyMenu(chatId, telegramId, s.welcomeNew(name), {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: s.roleTherapist, callback_data: 'role_therapist' }],
                        [{ text: s.roleClient, callback_data: 'role_client' }]
                    ]
                }
            }, false);
        }

        sendStickyMenu(chatId, telegramId, s.welcomeBack(name), {
            reply_markup: {
                inline_keyboard: [[{ text: s.openJournal, web_app: { url: miniAppUrl } }]]
            }
        }, false);
    });

    // ── Role selection callbacks ──────────────────────────────────────────────
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = String(query.from.id);
        const data = query.data;

        if (data.startsWith('role_')) {
            const role = data === 'role_therapist' ? 'therapist' : 'client';
            db.prepare("UPDATE users SET role = ?, onboardingStatus = 'completed' WHERE telegramId = ?")
                .run(role, telegramId);

            const user = db.prepare('SELECT * FROM users WHERE telegramId = ?').get(telegramId);
            const lang = getUserLang(user, query.from);
            const s = t(lang);

            const confirmMsg = (role === 'therapist' ? s.therapistModeOn : s.clientModeOn) + s.openAppBelow;

            bot.answerCallbackQuery(query.id);
            bot.editMessageText(confirmMsg, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: s.openJournal, web_app: { url: miniAppUrl } }]]
                }
            }).catch(() => { });
        }

        if (data === 'open_journal') {
            bot.answerCallbackQuery(query.id);
        }
    });

    // ── All text messages → save as journal entry ─────────────────────────────
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

        deleteUserMessage(chatId, msg.message_id);

        const user = upsertUser(telegramId, name);
        const lang = getUserLang(user, msg.from);
        const s = t(lang);

        const today = new Date().toISOString().split('T')[0];
        const result = db.prepare(
            'INSERT INTO journal_entries (userId, text, entryDate) VALUES (?, ?, ?)'
        ).run(user.id, msg.text, today);

        const entryId = result.lastInsertRowid;
        const dateLabel = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        sendStickyMenu(chatId, telegramId, s.entrySaved(dateLabel), {
            reply_markup: {
                inline_keyboard: [[{
                    text: s.viewEntry,
                    web_app: { url: `${miniAppUrl}?startapp=entry_${entryId}` }
                }]]
            }
        }, true);

        notifyTherapistsOfNewEntry(user.id, name, entryId);
    });

    bot.on('polling_error', (err) => {
        console.error('Bot polling error:', err.message);
    });

    console.log('🤖 Telegram bot started');
    return bot;
}

function notifyTherapistsOfNewEntry(userId) {
    if (!bot) return;

    // We don't send anything now. We just set/reset the 30-minute window for all connected therapists
    db.prepare(`
      UPDATE relationships 
      SET pendingNotificationAt = datetime('now', '+30 minutes')
      WHERE clientId = ?
    `).run(userId);
}

module.exports = { initBot, getBot, notifyTherapistsOfNewEntry, sendStickyMenu };
