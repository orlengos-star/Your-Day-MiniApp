import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Calendar from '../components/Calendar.jsx';
import EntryCard from '../components/EntryCard.jsx';
import DayRating from '../components/DayRating.jsx';
import TherapistNotes from '../components/TherapistNotes.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function TherapistView({ startParam, theme, onThemeChange, telegramColorScheme }) {
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
                window.Telegram.WebApp.openTelegramLink(
                    `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my Emotional Journal as my client 🌿')}`
                );
            }
        } catch (err) {
            alert('Failed to generate invite: ' + err.message);
        } finally {
            setInviteLoading(false);
        }
    }

    const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    return (
        <>
            {/* Header */}
            <header className="app-header">
                <div>
                    <h1>🌿 Journal</h1>
                    <div className="header-subtitle">Therapist view</div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle theme={theme} onChange={onThemeChange} telegramColorScheme={telegramColorScheme} />
                    <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">⚙️</button>
                </div>
            </header>

            {/* Tab bar */}
            <div className="tab-bar">
                <button
                    className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('journal')}
                >
                    My Journal
                </button>
                <button
                    className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
                    onClick={() => setActiveTab('clients')}
                >
                    My Clients {clients.length > 0 && `(${clients.length})`}
                </button>
            </div>

            {/* ── My Journal tab ── */}
            {activeTab === 'journal' && (
                <div className="page">
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📖</div>
                        <p style={{ fontSize: '0.875rem' }}>
                            Your personal journal works the same as your clients'.<br />
                            Send messages to the bot to create entries.
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
                            <h3>No clients yet</h3>
                            <p>Invite a client to connect their journal with you.</p>
                            <button
                                className="btn btn-primary mt-4"
                                onClick={handleInviteClient}
                                disabled={inviteLoading}
                            >
                                {inviteLoading ? 'Generating…' : '🔗 Invite a client'}
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
                                        📋 Copy link
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
                                    + Invite
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
                                        />
                                    </div>

                                    {/* Therapist private rating */}
                                    <div className="card">
                                        <DayRating
                                            value={dayRating?.therapistRating || null}
                                            onChange={handleTherapistRating}
                                            label={`Your private rating for ${selectedDate === today ? 'today' : dateLabel}`}
                                        />
                                        {dayRating?.clientRating && (
                                            <div className="text-xs text-muted mt-2" style={{ textAlign: 'center' }}>
                                                Client's own rating: {'😔😕😐🙂😊'[dayRating.clientRating - 1]} ({dayRating.clientRating}/5)
                                            </div>
                                        )}
                                    </div>

                                    {/* Entries */}
                                    <div className="section">
                                        <div className="section-header">
                                            <span className="section-title">
                                                {selectedDate === today ? "Today's entries" : dateLabel}
                                            </span>
                                            <span className="text-xs text-muted">{dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}</span>
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
                                                <h3>No entries for this day</h3>
                                                <p>{selectedClient.name} hasn't written anything yet for this date.</p>
                                            </div>
                                        ) : (
                                            dayEntries.map(entry => (
                                                <div key={entry.id}>
                                                    <EntryCard
                                                        entry={entry}
                                                        onClick={setSelectedEntry}
                                                        isTherapist
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
                                <h3>Journal Entry</h3>
                                <div className="text-xs text-muted mt-1">
                                    {new Date(selectedEntry.createdAt).toLocaleString('en-GB', {
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

                        <TherapistNotes entry={selectedEntry} onUpdate={handleEntryUpdate} />
                    </div>
                </div>
            )}

            {/* Settings drawer */}
            {showSettings && (
                <NotificationSettings onClose={() => setShowSettings(false)} />
            )}
        </>
    );
}
