import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Calendar from '../components/Calendar.jsx';
import EntryCard from '../components/EntryCard.jsx';
import DayRating from '../components/DayRating.jsx';
import TherapistNotes from '../components/TherapistNotes.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function TherapistView({ user, onUserChange, startParam, theme, onThemeChange, telegramColorScheme, lang, onLangChange, t }) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonthDefault = today.slice(0, 7);

    const [activeTab, setActiveTab] = useState('journal'); // 'journal' | 'clients'
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(currentMonthDefault);
    const [selectedDate, setSelectedDate] = useState(today);
    const [entries, setEntries] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [inviteLink, setInviteLink] = useState(null);
    const [inviteLoading, setInviteLoading] = useState(false);

    // Load clients
    useEffect(() => {
        api.relationships.getClients()
            .then(list => {
                setClients(list);
                if (list.length > 0 && !selectedClientId) setSelectedClientId(list[0].id);
            })
            .catch(console.error);
    }, []);

    // Load client data when client or month changes
    const loadClientData = useCallback(async (clientId, month) => {
        if (!clientId) return;
        setLoading(true);
        try {
            const [clientEntries, clientRatings] = await Promise.all([
                api.entries.list({ month, clientId }),
                api.ratings.list({ month, clientId }),
            ]);
            setEntries(clientEntries);
            setRatings(clientRatings);
        } catch (err) {
            console.error('Failed to load client data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'clients' && selectedClientId) {
            loadClientData(selectedClientId, currentMonth);
        }
    }, [activeTab, selectedClientId, currentMonth, loadClientData]);

    // Handle deep-link
    useEffect(() => {
        if (!startParam) return;
        const match = startParam.match(/^entry_(\d+)$/);
        if (match) {
            api.entries.get(match[1]).then(entry => {
                if (entry) {
                    setActiveTab('clients');
                    setSelectedClientId(entry.userId);
                    setCurrentMonth(entry.entryDate.slice(0, 7));
                    setSelectedDate(entry.entryDate);
                    setSelectedEntry(entry);
                }
            }).catch(console.error);
        }
    }, [startParam]);

    const dayEntries = entries.filter(e => e.entryDate === selectedDate);
    const dayRating = ratings.find(r => r.date === selectedDate);
    const selectedClient = clients.find(c => c.id === selectedClientId);

    function handleEntryUpdate(updated) {
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        if (selectedEntry?.id === updated.id) setSelectedEntry(updated);
    }

    async function handleTherapistRating(value) {
        try {
            const updated = await api.ratings.upsert({
                date: selectedDate,
                therapistRating: value,
                clientId: selectedClientId,
            });
            setRatings(prev => {
                const idx = prev.findIndex(r => r.date === selectedDate);
                if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
                return [...prev, updated];
            });
        } catch (err) {
            console.error('Rating failed:', err);
        }
    }

    async function handleInviteClient() {
        setInviteLoading(true);
        try {
            const { link } = await api.relationships.createInvite('invite_client');
            setInviteLink(link);
            if (window.Telegram?.WebApp?.openTelegramLink) {
                const shareMsg = lang === 'ru' ? 'Приглашаю вас вести дневник в приложении "Мой Дневник" 🌿' : 'Join my Emotional Journal as my client 🌿';
                window.Telegram.WebApp.openTelegramLink(
                    `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareMsg)}`
                );
            }
        } catch (err) {
            alert('Failed to generate invite: ' + err.message);
        } finally {
            setInviteLoading(false);
        }
    }

    const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    return (
        <>
            {/* Header */}
            <header className="app-header">
                <div>
                    <h1>🌿 {t('appTitle')}</h1>
                    <div className="header-subtitle">{t('therapistView')}</div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle theme={theme} onChange={onThemeChange} telegramColorScheme={telegramColorScheme} />
                    <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label={t('settings')}>⚙️</button>
                </div>
            </header>

            {/* Tab bar */}
            <div className="tab-bar">
                <button
                    className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('journal')}
                >
                    {lang === 'ru' ? 'Мой личный дневник' : 'My Journal'}
                </button>
                <button
                    className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
                    onClick={() => setActiveTab('clients')}
                >
                    {lang === 'ru' ? 'Мои клиенты' : 'My Clients'} {clients.length > 0 && `(${clients.length})`}
                </button>
            </div>

            {/* ── My Journal tab ── */}
            {activeTab === 'journal' && (
                <div className="page">
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📖</div>
                        <p style={{ fontSize: '0.875rem' }}>
                            {lang === 'ru'
                                ? 'Ваш личный дневник работает так же, как и у ваших клиентов. Чтобы создать запись, просто отправьте сообщение боту.'
                                : "Your personal journal works the same as your clients'. Send messages to the bot to create entries."}
                        </p>
                    </div>
                </div>
            )}

            {/* ── My Clients tab ── */}
            {activeTab === 'clients' && (
                <div className="page">
                    {/* Client selector */}
                    {clients.length === 0 ? (
                        <div className="empty-state mt-6">
                            <div className="empty-state-icon">👥</div>
                            <h3>{t('noClients')}</h3>
                            <p>{t('noClientsSub')}</p>
                            <button
                                className="btn btn-primary mt-4"
                                onClick={handleInviteClient}
                                disabled={inviteLoading}
                            >
                                {inviteLoading ? t('generating') : `🔗 ${t('inviteClient')}`}
                            </button>
                            {inviteLink && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '0.5rem 0.75rem',
                                        fontSize: '0.75rem',
                                        wordBreak: 'break-all',
                                        color: 'var(--text-2)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        {inviteLink}
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => navigator.clipboard?.writeText(inviteLink)}
                                    >
                                        📋 {t('copyLink')}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Client chips */}
                            <div className="client-selector">
                                {clients.map(c => (
                                    <button
                                        key={c.id}
                                        className={`client-chip ${selectedClientId === c.id ? 'active' : ''}`}
                                        onClick={() => { setSelectedClientId(c.id); setSelectedEntry(null); }}
                                    >
                                        {c.name || `Client #${c.id}`}
                                    </button>
                                ))}
                                <button
                                    className="client-chip"
                                    onClick={handleInviteClient}
                                    disabled={inviteLoading}
                                    style={{ borderStyle: 'dashed' }}
                                >
                                    + {lang === 'ru' ? 'Пригласить' : 'Invite'}
                                </button>
                            </div>

                            {selectedClient && (
                                <>
                                    {/* Calendar */}
                                    <div className="mt-3">
                                        <Calendar
                                            currentMonth={currentMonth}
                                            onMonthChange={m => { setCurrentMonth(m); setSelectedDate(m + '-01'); }}
                                            onDaySelect={setSelectedDate}
                                            selectedDate={selectedDate}
                                            ratings={ratings}
                                            entries={entries}
                                            forceCollapse={!!selectedEntry}
                                            lang={lang}
                                        />
                                    </div>


                                    {/* Entries */}
                                    <div className="section">
                                        <div className="section-header">
                                            <span className="section-title">
                                                {selectedDate === today ? t('todaysEntries') : dateLabel}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted">{t('entriesCount', dayEntries.length)}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-3 mb-4">
                                            {dayRating?.clientRating && (
                                                <span className="text-xs text-muted">
                                                    {t('clientRated', '😔😕😐🙂😊'[dayRating.clientRating - 1])}
                                                </span>
                                            )}
                                            <DayRating
                                                value={dayRating?.therapistRating || null}
                                                onChange={handleTherapistRating}
                                                t={t}
                                            />
                                        </div>

                                        {loading ? (
                                            <div className="card">
                                                <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                                                <div className="skeleton skeleton-text" />
                                                <div className="skeleton skeleton-text" />
                                            </div>
                                        ) : dayEntries.length === 0 ? (
                                            <div className="empty-state">
                                                <div className="empty-state-icon">📝</div>
                                                <h3>{lang === 'ru' ? 'Нет записей' : 'No entries for this day'}</h3>
                                                <p>{lang === 'ru'
                                                    ? `${selectedClient.name} пока ничего не записал(а) за эту дату.`
                                                    : `${selectedClient.name} hasn't written anything yet for this date.`}</p>
                                            </div>
                                        ) : (
                                            dayEntries.map(entry => (
                                                <div key={entry.id}>
                                                    <EntryCard
                                                        entry={entry}
                                                        onClick={setSelectedEntry}
                                                        isTherapist
                                                        t={t}
                                                        lang={lang}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Entry detail drawer (therapist view) */}
            {selectedEntry && (
                <div className="overlay" onClick={e => e.target === e.currentTarget && setSelectedEntry(null)}>
                    <div className="drawer">
                        <div className="drawer-handle" />
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3>{lang === 'ru' ? 'Запись в дневнике' : 'Journal Entry'}</h3>
                                <div className="text-xs text-muted mt-1">
                                    {new Date(selectedEntry.createdAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </div>
                            </div>
                            <button className="icon-btn" onClick={() => setSelectedEntry(null)}>✕</button>
                        </div>

                        <div style={{
                            background: 'var(--surface-2)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            fontSize: '0.9375rem',
                            lineHeight: '1.7',
                            color: 'var(--text)',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {selectedEntry.text}
                        </div>

                        <TherapistNotes
                            entry={selectedEntry}
                            onUpdate={handleEntryUpdate}
                            t={t}
                        />
                    </div>
                </div>
            )}

            {/* Settings drawer */}
            {showSettings && (
                <NotificationSettings
                    user={user}
                    onUserChange={onUserChange}
                    onClose={() => setShowSettings(false)}
                    lang={lang}
                    onLangChange={onLangChange}
                    t={t}
                />
            )}
        </>
    );
}
