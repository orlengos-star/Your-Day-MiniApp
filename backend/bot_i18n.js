/**
 * Bot i18n — all user-facing strings for the Telegram bot.
 * Default language is Russian.
 */

const botStrings = {
    ru: {
        // Onboarding
        welcomeNew: (name) => `👋 Привет, *${name}*! Добро пожаловать в твой Дневник Эмоций.\n\nПрежде чем начать, как ты планируешь использовать это приложение?`,
        roleTherapist: '🧠 Я работаю с клиентами ',
        roleClient: '📝 Я веду личный дневник',
        welcomeBack: (name) => `👋 Привет, *${name}*! Рад снова видеть тебя.\n\nОтправь любое сообщение, и я сохраню его как запись в дневнике. Или открой дневник напрямую:`,
        openJournal: '📖 Открыть дневник',
        viewEntry: '📖 Открыть запись',
        writeNow: '✍️ Сделать запись',

        // Invite flow
        invalidInvite: '❌ Эта ссылка-приглашение недействительна или устарела.',
        inviteGone: '❌ Приглашение больше не актуально.',
        alreadyConnected: '✅ Вы уже подключены!',
        selfInvite: '⚠️ Вы не можете принять собственное приглашение.',
        inviteAsTherapist: (inviterName) => `✅ Подключено! Теперь вы являетесь психотерапевтом для *${inviterName}*.\n\nОткройте дневник 👇`,
        inviteAsClient: (name, therapistName) => `👋 Здравствуйте, *${name}*!\n\nВаш психотерапевт *${therapistName}* пригласил вас вести Дневник Эмоций. 🌊\n\nПриложение поможет отслеживать ваши эмоции, и удобно делиться записями с вашим терапевтом.\n\nОткройте дневник, чтобы начать:`,

        // Role selection confirmation
        therapistModeOn: '✅ Профессиональный режим активирован. Вы можете приглашать клиентов и управлять их дневниками.',
        clientModeOn: '✅ Личный режим активирован. Отправьте мне любое сообщение, чтобы начать дневник!',
        openAppBelow: '\n\n👇 Откройте приложение ниже:',

        // Quick journaling (after saving an entry)
        entrySaved: (dateLabel) => `✅ Запись сохранена за *${dateLabel}*.\n\nОтправьте следующее сообщение, чтобы продолжить, или откройте дневник:`,

        // Scheduled reminders (client)
        reminderNoEntry: (name) => `🕰️ Привет, ${name}! Сегодня ты ещё ничего не записал.\n\nКак ты себя чувствуешь? Даже короткая запись будет лучше, чем ничего. 💙`,
        reminderFewEntries: (count) => `🌊 Сегодня ты написал ${count} ${count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'} — отличное начало!\n\nХочешь добавить ещё что-то до конца дня? 📝`,

        // Therapist notifications
        newEntryNotif: (clientName) => `📝 *${clientName}* только что добавил новую запись в дневник.`,
        viewEntryBtn: '👁 Посмотреть',

        // Therapist batch digest
        digestTitle: '📊 *Сводка за сегодня*',
        digestEntry: (name, count) => `• ${name}: ${count} ${count === 1 ? 'запись' : count < 5 ? 'записи' : 'записей'}`,
        digestTotal: (n) => `\n\nВсего: ${n} новых ${n === 1 ? 'записи' : 'записей'}`,
    },

    en: {
        // Onboarding
        welcomeNew: (name) => `👋 Hello, *${name}*! Welcome to your Emotional Journal.\n\nBefore we begin, how do you plan to use this app?`,
        roleTherapist: '🧠 I am a Professional (Therapist)',
        roleClient: '📝 I am using it for my Personal diary',
        welcomeBack: (name) => `👋 Hello, *${name}*! Welcome back.\n\nSend me any message to save a journal entry, or open your journal directly:`,
        openJournal: '📖 Open Journal',
        viewEntry: '📖 View entry',
        writeNow: '✍️ Write now',

        // Invite flow
        invalidInvite: '❌ This invite link is invalid or has expired.',
        inviteGone: '❌ Invite is no longer valid.',
        alreadyConnected: '✅ You are already connected!',
        selfInvite: '⚠️ You cannot accept your own invite.',
        inviteAsTherapist: (inviterName) => `✅ Connected! You are now the therapist for *${inviterName}*.\n\nOpen your journal below 👇`,
        inviteAsClient: (name, therapistName) => `👋 Hello, *${name}*!\n\nYou have been invited by your therapist, *${therapistName}*, to use the Emotional Journal. 🌊\n\nThis app helps you track your daily emotions to share with your therapist during sessions.\n\nOpen your journal to get started:`,

        // Role selection confirmation
        therapistModeOn: '✅ Professional mode activated. You can now invite clients and manage their journals.',
        clientModeOn: '✅ Personal mode activated. Send me any message to start your diary!',
        openAppBelow: '\n\n👇 Open your app below:',

        // Quick journaling
        entrySaved: (dateLabel) => `✅ Entry saved for *${dateLabel}*.\n\nSend another message to keep writing, or open the journal:`,

        // Scheduled reminders (client)
        reminderNoEntry: (name) => `🕰️ Hey ${name}, you haven't written anything today yet.\n\nHow are you feeling? Even a few words can help. 💙`,
        reminderFewEntries: (count) => `🌊 You've written ${count} ${count === 1 ? 'entry' : 'entries'} today — great start!\n\nWant to add more before the day ends? 📝`,

        // Therapist notifications
        newEntryNotif: (clientName) => `📝 *${clientName}* just added a new journal entry.`,
        viewEntryBtn: '👁 View entry',

        // Therapist batch digest
        digestTitle: '📊 *Today\'s Client Summary*',
        digestEntry: (name, count) => `• ${name}: ${count} ${count === 1 ? 'entry' : 'entries'}`,
        digestTotal: (n) => `\n\nTotal: ${n} new ${n === 1 ? 'entry' : 'entries'}`,
    },
};

/**
 * Get the localized string helper for a given lang code.
 * Falls back to Russian if lang is unknown.
 */
function t(lang) {
    return botStrings[lang] || botStrings['ru'];
}

module.exports = { t };
