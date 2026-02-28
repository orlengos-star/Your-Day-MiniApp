import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Calendar from '../components/Calendar.jsx';
import EntryCard from '../components/EntryCard.jsx';
import DayRating from '../components/DayRating.jsx';
import TherapistNotes from '../components/TherapistNotes.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import ClientList from '../components/ClientList.jsx';
import ClientProfileCard from '../components/ClientProfileCard.jsx';

export default function TherapistView({ user, onUserChange, startParam, theme, onThemeChange, telegramColorScheme, lang, onLangChange, t }) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonthDefault = today.slice(0, 7);

    // State
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [activeDetailTab, setActiveDetailTab] = useState('card'); // 'card' | 'diary'

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
    const loadClients = useCallback(() => {
        api.relationships.getClients()
            .then(setClients)
            .catch(console.error);
    }, []);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

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
        if (selectedClientId) {
            loadClientData(selectedClientId, currentMonth);
        }
    }, [selectedClientId, currentMonth, loadClientData]);

    // Handle deep-link
    useEffect(() => {
        if (!startParam) return;
        const match = startParam.match(/^entry_(\d+)$/);
        if (match) {
            api.entries.get(match[1]).then(entry => {
                if (entry) {
                    setSelectedClientId(entry.userId);
                    setActiveDetailTab('diary');
                    setCurrentMonth(entry.entryDate.slice(0, 7));
                    setSelectedDate(entry.entryDate);
                    setSelectedEntry(entry);
                    api.relationships.markViewed(entry.userId).then(loadClients);
                }
            }).catch(console.error);
        }
    }, [startParam, loadClients]);

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const dayEntries = entries.filter(e => e.entryDate === selectedDate);
    const dayRating = ratings.find(r => r.date === selectedDate);

    function handleSelectClient(client) {
        setSelectedClientId(client.id);
        setActiveDetailTab('card');
        // Clear unread badge
        if (client.unreadCount > 0) {
            api.relationships.markViewed(client.id).then(loadClients);
        }
    }

    async function handleToggleArchive(relId, isArchived) {
        try {
            await api.relationships.toggleArchive(relId, isArchived);
            loadClients();
        } catch (err) {
            alert('Failed to update: ' + err.message);
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

    function handleProfileUpdate(clientId, updates) {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c));
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

    function handleEntryUpdate(updated) {
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        if (selectedEntry?.id === updated.id) setSelectedEntry(updated);
    }

    const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    return (
        <>
            {/* Header */}
            <header className="app-header">
                <div className="flex items-center gap-3">
                    {selectedClientId && (
                        <button className="icon-btn" onClick={() => setSelectedClientId(null)}>←</button>
                    )}
                    {!selectedClientId && (
                        <img src="/logo.png" alt="Logo" className="app-logo" />
                    )}
                    <div>
                        <h1>{selectedClientId ? (selectedClient?.name || 'Client') : t('appTitle')}</h1>
                        <div className="header-subtitle">{selectedClientId ? t('clientProfile') : t('therapistDashboard')}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle theme={theme} onChange={onThemeChange} telegramColorScheme={telegramColorScheme} />
                    <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label={t('settings')}>⚙️</button>
                </div>
            </header>

            <div className="page">
                {!selectedClientId ? (
                    <ClientList
                        clients={clients}
                        onSelectClient={handleSelectClient}
                        onToggleArchive={handleToggleArchive}
                        onInviteClient={handleInviteClient}
                        inviteLoading={inviteLoading}
                        inviteLink={inviteLink}
                        t={t}
                        lang={lang}
                    />
                ) : (
                    <>
                        {/* Client Dashboard Tabs */}
                        <div className="tab-bar mb-4" style={{ position: 'sticky', top: '0', background: 'var(--bg)' }}>
                            <button
                                className={`tab-btn ${activeDetailTab === 'card' ? 'active' : ''}`}
                                onClick={() => setActiveDetailTab('card')}
                            >
                                📋 {t('clientCard')}
                            </button>
                            <button
                                className={`tab-btn ${activeDetailTab === 'diary' ? 'active' : ''}`}
                                onClick={() => setActiveDetailTab('diary')}
                            >
                                📖 {t('clientDiary')}
                            </button>
                        </div>

                        {activeDetailTab === 'card' && (
                            <ClientProfileCard
                                client={selectedClient}
                                onUpdate={handleProfileUpdate}
                                onArchiveToggle={handleToggleArchive}
                                t={t}
                                lang={lang}
                            />
                        )}

                        {activeDetailTab === 'diary' && (
                            <>
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

                                <div className="section mt-4">
                                    <div className="section-header">
                                        <span className="section-title">
                                            {selectedDate === today ? t('todaysEntries') : dateLabel}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="badge badge-ghost text-muted">{dayEntries.length}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-3 mb-6">
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

                                    <div className="flex flex-col gap-3">
                                        {loading ? (
                                            <div className="card text-center text-muted py-8">{t('loading')}</div>
                                        ) : dayEntries.length === 0 ? (
                                            <div className="empty-state py-8">
                                                <div className="empty-state-icon">📝</div>
                                                <p>{t('noEntriesDate')}</p>
                                            </div>
                                        ) : (
                                            dayEntries.map(entry => (
                                                <EntryCard
                                                    key={entry.id}
                                                    entry={entry}
                                                    onClick={setSelectedEntry}
                                                    isTherapist
                                                    t={t}
                                                    lang={lang}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Entry detail drawer */}
            {selectedEntry && (
                <div className="overlay" onClick={e => e.target === e.currentTarget && setSelectedEntry(null)}>
                    <div className="drawer">
                        <div className="drawer-handle" />
                        <div className="flex items-center justify-between mt-4 mb-4">
                            <div>
                                <h3>{t('journalEntry')}</h3>
                                <div className="text-xs text-muted mt-1">
                                    {new Date(selectedEntry.createdAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </div>
                            </div>
                            <button className="icon-btn" onClick={() => setSelectedEntry(null)}>✕</button>
                        </div>

                        <div className="card mb-4" style={{ background: 'var(--surface-2)', whiteSpace: 'pre-wrap' }}>
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
