const cron = require('node-cron');
const { db } = require('./db');

let botRef = null;
let stickyMenuFn = null;

function initScheduler(bot, sendStickyMenu) {
    botRef = bot;
    stickyMenuFn = sendStickyMenu;

    // Run every minute — check who needs a reminder right now
    cron.schedule('* * * * *', async () => {
        if (!botRef) return;

        const now = new Date();
        // Calculate current UTC time in minutes since midnight
        const utcMinutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
        const todayUtcDate = now.toISOString().split('T')[0];

        // ── Client reminders ─────────────────────────────────────────────────────
        const activeClients = db.prepare(`
      SELECT u.id, u.telegramId, u.name, 
             COALESCE(ns.reminderTime, '20:00') as reminderTime,
             COALESCE(ns.timezoneOffset, 0) as timezoneOffset,
             COUNT(je.id) as entryCount
      FROM users u
      LEFT JOIN notification_settings ns ON ns.userId = u.id
      LEFT JOIN journal_entries je ON je.userId = u.id AND je.entryDate = ?
      WHERE u.role = 'client'
        AND COALESCE(ns.enabled, 1) = 1
      GROUP BY u.id
    `).all(todayUtcDate);

        for (const client of activeClients) {
            let localMinutes = utcMinutesSinceMidnight - client.timezoneOffset;
            if (localMinutes < 0) localMinutes += 24 * 60;
            if (localMinutes >= 24 * 60) localMinutes -= 24 * 60;

            const localH = Math.floor(localMinutes / 60);
            const localM = localMinutes % 60;
            const currentLocalTimeStr = `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`;

            if (currentLocalTimeStr !== client.reminderTime) continue;

            let text;
            if (client.entryCount === 0) {
                text = `🕰️ Hey ${client.name}, you haven't written anything today yet.\n\nHow are you feeling? Even a few words can help. 💙`;
            } else if (client.entryCount < 3) {
                text = `🌊 You've written ${client.entryCount} ${client.entryCount === 1 ? 'entry' : 'entries'} today — great start!\n\nWant to add more before the day ends? 📝`;
            } else {
                continue; // Already wrote enough — don't nag
            }

            // Loud: send new message so Telegram delivers a push notification
            stickyMenuFn(client.telegramId, client.telegramId, text, {
                reply_markup: {
                    inline_keyboard: [[{
                        text: '✍️ Write now',
                        callback_data: 'open_journal'
                    }]]
                }
            }, false).catch(() => { });
        }

        // ── Therapist batch digest ────────────────────────────────────────────────
        const activeTherapists = db.prepare(`
      SELECT u.telegramId, u.id as therapistDbId, 
             COALESCE(ns.batchTime, '18:00') as batchTime,
             COALESCE(ns.timezoneOffset, 0) as timezoneOffset
      FROM users u
      JOIN notification_settings ns ON ns.userId = u.id
      WHERE u.role = 'therapist'
        AND ns.enabled = 1
        AND ns.therapistMode = 'batch_digest'
    `).all();

        for (const therapist of activeTherapists) {
            let localMinutes = utcMinutesSinceMidnight - therapist.timezoneOffset;
            if (localMinutes < 0) localMinutes += 24 * 60;
            if (localMinutes >= 24 * 60) localMinutes -= 24 * 60;

            const localH = Math.floor(localMinutes / 60);
            const localM = localMinutes % 60;
            const currentLocalTimeStr = `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`;

            if (currentLocalTimeStr !== therapist.batchTime) continue;

            const newEntries = db.prepare(`
        SELECT je.text, u.name, je.createdAt
        FROM journal_entries je
        JOIN users u ON u.id = je.userId
        JOIN relationships r ON r.clientId = je.userId
        WHERE r.therapistId = ?
          AND je.entryDate = ?
        ORDER BY u.name, je.createdAt
      `).all(therapist.therapistDbId, todayUtcDate);

            if (newEntries.length === 0) continue;

            const grouped = {};
            for (const entry of newEntries) {
                if (!grouped[entry.name]) grouped[entry.name] = 0;
                grouped[entry.name]++;
            }

            const summary = Object.entries(grouped)
                .map(([name, count]) => `• ${name}: ${count} ${count === 1 ? 'entry' : 'entries'}`)
                .join('\n');

            // Loud: send new message so therapist gets a push notification
            stickyMenuFn(therapist.telegramId, therapist.telegramId,
                `📊 *Today's Client Summary*\n\n${summary}\n\nTotal: ${newEntries.length} new ${newEntries.length === 1 ? 'entry' : 'entries'}`,
                {},
                false
            ).catch(() => { });
        }
    });

    console.log('⏰ Notification scheduler started');
}

module.exports = { initScheduler };
