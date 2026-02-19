import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function NotificationSettings({ onClose }) {
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.notifications.getSettings().then(setSettings).catch(console.error);
    }, []);

    async function update(patch) {
        const optimistic = { ...settings, ...patch };
        setSettings(optimistic);
        setSaving(true);
        try {
            const updated = await api.notifications.updateSettings(patch);
            setSettings(updated);
        } catch (err) {
            setSettings(settings); // revert
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    if (!settings) {
        return (
            <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="drawer">
                    <div className="drawer-handle" />
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>Loading…</div>
                </div>
            </div>
        );
    }

    return (
        <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="drawer">
                <div className="drawer-handle" />

                <div className="flex items-center justify-between mb-4">
                    <h3>Notification Settings</h3>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>

                <div className="card">
                    {/* Enable/disable */}
                    <div className="settings-row">
                        <div>
                            <div className="settings-label">Daily Reminders</div>
                            <div className="settings-sublabel">Get reminded to journal each day</div>
                        </div>
                        <label className="toggle">
                            <input
                                type="checkbox"
                                checked={!!settings.enabled}
                                onChange={e => update({ enabled: e.target.checked })}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>

                    {/* Reminder time */}
                    {settings.enabled ? (
                        <div className="settings-row">
                            <div>
                                <div className="settings-label">Reminder Time</div>
                                <div className="settings-sublabel">When to send your daily nudge</div>
                            </div>
                            <input
                                type="time"
                                className="input"
                                value={settings.reminderTime}
                                onChange={e => update({ reminderTime: e.target.value })}
                                style={{ width: 'auto', padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
                            />
                        </div>
                    ) : null}
                </div>

                {/* Therapist-specific settings */}
                {settings.therapistMode !== undefined && (
                    <div className="card mt-3">
                        <div className="section-title mb-2">Therapist Notifications</div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-label">Notification Mode</div>
                                <div className="settings-sublabel">How to receive client updates</div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button
                                className={`btn btn-sm ${settings.therapistMode === 'per_client' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => update({ therapistMode: 'per_client' })}
                                style={{ flex: 1 }}
                            >
                                Instant
                            </button>
                            <button
                                className={`btn btn-sm ${settings.therapistMode === 'batch_digest' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => update({ therapistMode: 'batch_digest' })}
                                style={{ flex: 1 }}
                            >
                                Daily digest
                            </button>
                        </div>

                        {settings.therapistMode === 'batch_digest' && (
                            <div className="settings-row mt-3">
                                <div className="settings-label">Digest Time</div>
                                <input
                                    type="time"
                                    className="input"
                                    value={settings.batchTime}
                                    onChange={e => update({ batchTime: e.target.value })}
                                    style={{ width: 'auto', padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {saving && (
                    <div className="text-xs text-muted mt-3" style={{ textAlign: 'center' }}>Saving…</div>
                )}
            </div>
        </div>
    );
}
