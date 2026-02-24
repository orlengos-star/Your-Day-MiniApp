import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function NotificationSettings({
    onClose,
    therapist,
    onInviteTherapist,
    inviteLink,
    inviteLoading,
    onDisconnect,
    lang,
    onLangChange,
    t
}) {
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
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>{t('loading')}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="drawer">
                <div className="drawer-handle" />

                <div className="flex items-center justify-between mb-4">
                    <h3>{t('settings')}</h3>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>

                <div className="section-title mb-2">{t('language')}</div>
                <div className="flex gap-2 mb-4">
                    <button
                        className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => onLangChange('en')}
                        style={{ flex: 1 }}
                    >
                        🇬🇧 English
                    </button>
                    <button
                        className={`btn btn-sm ${lang === 'ru' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => onLangChange('ru')}
                        style={{ flex: 1 }}
                    >
                        🇷🇺 Русский
                    </button>
                </div>

                <div className="section-title mb-2">{t('notifications')}</div>
                <div className="card mb-4">
                    {/* Enable/disable */}
                    <div className="settings-row">
                        <div>
                            <div className="settings-label">{t('dailyReminders')}</div>
                            <div className="settings-sublabel">{t('dailyRemindersSub')}</div>
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
                                <div className="settings-label">{t('reminderTime')}</div>
                                <div className="settings-sublabel">{t('reminderTimeSub')}</div>
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

                {/* Therapist Connection */}
                <div className="section-title mb-2">{t('therapist')}</div>
                <div className="card mb-4">
                    {therapist ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="settings-label">{t('connectedWith', therapist.name)}</div>
                                <div className="settings-sublabel">{t('connectedOn', new Date(therapist.connectedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB'))}</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>{t('disconnect')}</button>
                        </div>
                    ) : (
                        <div>
                            <div className="settings-label">{t('notConnected')}</div>
                            <div className="settings-sublabel mb-3">{t('inviteSub')}</div>

                            {inviteLink ? (
                                <div style={{
                                    background: 'var(--surface-2)',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    wordBreak: 'break-all',
                                    marginBottom: '0.5rem',
                                    color: 'var(--text-2)'
                                }}>
                                    {inviteLink}
                                    <button
                                        className="btn btn-primary btn-sm w-full mt-2"
                                        onClick={() => navigator.clipboard?.writeText(inviteLink)}
                                    >
                                        📋 {t('copyInvite')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-primary btn-sm w-full"
                                    onClick={onInviteTherapist}
                                    disabled={inviteLoading}
                                >
                                    {inviteLoading ? t('generating') : `🔗 ${t('generateInvite')}`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Therapist-specific settings (if user is therapist) */}
                {settings.therapistMode !== undefined && (
                    <div className="card mt-3">
                        <div className="section-title mb-2">{t('professionalMode')}</div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-label">{t('notificationMode')}</div>
                                <div className="settings-sublabel">{t('notificationModeSub')}</div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button
                                className={`btn btn-sm ${settings.therapistMode === 'per_client' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => update({ therapistMode: 'per_client' })}
                                style={{ flex: 1 }}
                            >
                                {t('instant')}
                            </button>
                            <button
                                className={`btn btn-sm ${settings.therapistMode === 'batch_digest' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => update({ therapistMode: 'batch_digest' })}
                                style={{ flex: 1 }}
                            >
                                {t('dailyDigest')}
                            </button>
                        </div>

                        {settings.therapistMode === 'batch_digest' && (
                            <div className="settings-row mt-3">
                                <div className="settings-label">{t('digestTime')}</div>
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
                    <div className="text-xs text-muted mt-3" style={{ textAlign: 'center' }}>{t('saving')}</div>
                )}
            </div>
        </div>
    );
}
