const cron = require('node-cron');
const { db } = require('./db');

let botRef = null;

function initScheduler(bot) {
    botRef = bot;

    // Run every minute — check who needs a reminder right now
    cron.schedule('* * * * *', () => {
        if (!botRef) return;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const today = now.toISOString().split('T')[0];

        // ── Client reminders ─────────────────────────────────────────────────────
        const clientsToRemind = db.prepare(`
      SELECT u.telegramId, u.name, ns.reminderTime,
             COUNT(je.id) as entryCount
      FROM users u
      JOIN notification_settings ns ON ns.userId = u.id
      LEFT JOIN journal_entries je ON je.userId = u.id AND je.entryDate = ?
      WHERE u.role = 'client'
        AND ns.enabled = 1
        AND ns.reminderTime = ?
      GROUP BY u.id
    `).all(today, currentTime);

        for (const client of clientsToRemind) {
            if (client.entryCount === 0) {
                botRef.sendMessage(client.telegramId,
                    `🌿 Hey ${client.name}, you haven't written anything today yet.\n\nHow are you feeling? Even a few words can help. 💙`,
                    {
                        reply_markup: {
                            inline_keyboard: [[{
                                text: '✍️ Write now',
                                callback_data: 'open_journal'
                            }]]
                        }
                    }
                ).catch(() => { });
            } else if (client.entryCount < 3) {
                botRef.sendMessage(client.telegramId,
                    `🌿 You've written ${client.entryCount} ${client.entryCount === 1 ? 'entry' : 'entries'} today — great start!\n\nWant to add more before the day ends? 📝`
                ).catch(() => { });
            }
        }

        // ── Therapist batch digest ────────────────────────────────────────────────
        const therapistsBatch = db.prepare(`
      SELECT u.telegramId, u.id as therapistDbId, ns.batchTime
      FROM users u
      JOIN notification_settings ns ON ns.userId = u.id
      WHERE u.role = 'therapist'
        AND ns.enabled = 1
        AND ns.therapistMode = 'batch_digest'
        AND ns.batchTime = ?
    `).all(currentTime);

        for (const therapist of therapistsBatch) {
            const newEntries = db.prepare(`
        SELECT je.text, u.name, je.createdAt
        FROM journal_entries je
        JOIN users u ON u.id = je.userId
        JOIN relationships r ON r.clientId = je.userId
        WHERE r.therapistId = ?
          AND je.entryDate = ?
        ORDER BY u.name, je.createdAt
      `).all(therapist.therapistDbId, today);

            if (newEntries.length === 0) continue;

            const grouped = {};
            for (const entry of newEntries) {
                if (!grouped[entry.name]) grouped[entry.name] = 0;
                grouped[entry.name]++;
            }

            const summary = Object.entries(grouped)
                .map(([name, count]) => `• ${name}: ${count} ${count === 1 ? 'entry' : 'entries'}`)
                .join('\n');

            botRef.sendMessage(therapist.telegramId,
                `📊 *Today's Client Summary*\n\n${summary}\n\nTotal: ${newEntries.length} new ${newEntries.length === 1 ? 'entry' : 'entries'}`,
                { parse_mode: 'Markdown' }
            ).catch(() => { });
        }
    });

    console.log('⏰ Notification scheduler started');
}

module.exports = { initScheduler };
