import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import Calendar from '../components/Calendar.jsx';
import EntryCard from '../components/EntryCard.jsx';
import EntryEditor from '../components/EntryEditor.jsx';
import DayRating from '../components/DayRating.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function ClientView({ startParam, theme, onThemeChange, telegramColorScheme }) {
    const today = new Date().toISOString().split('T')[0];
    const currentMonthDefault = today.slice(0, 7);

    const [currentMonth, setCurrentMonth] = useState(currentMonthDefault);
    const [selectedDate, setSelectedDate] = useState(today);
    const [entries, setEntries] = useState([]);
    const [allMonthEntries, setAllMonthEntries] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEntry, setEditingEntry] = useState(null); // null | 'new' | entry object
    const [showSettings, setShowSettings] = useState(false);
    const [inviteLink, setInviteLink] = useState(null);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [therapist, setTherapist] = useState(undefined); // undefined=loading, null=none

    // Load month data
    const loadMonth = useCallback(async (month) => {
        setLoading(true);
        try {
            const [monthEntries, monthRatings] = await Promise.all([
                api.entries.list({ month }),
                api.ratings.list({ month }),
            ]);
            setAllMonthEntries(monthEntries);
            setRatings(monthRatings);
        } catch (err) {
            console.error('Failed to load month data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadMonth(currentMonth); }, [currentMonth, loadMonth]);

    // Load therapist connection
    useEffect(() => {
        api.relationships.getTherapist()
            .then(setTherapist)
            .catch(() => setTherapist(null));
    }, []);

    // Handle deep-link start param (e.g. entry_42)
    useEffect(() => {
        if (!startParam) return;
        const match = startParam.match(/^entry_(\d+)$/);
        if (match) {
            api.entries.get(match[1]).then(entry => {
                if (entry) {
                    setSelectedDate(entry.entryDate);
                    setCurrentMonth(entry.entryDate.slice(0, 7));
                    setEditingEntry(entry);
                }
            }).catch(console.error);
        }
    }, [startParam]);

    // Filter entries for selected date
    const dayEntries = allMonthEntries.filter(e => e.entryDate === selectedDate);

    // Get rating for selected date
    const dayRating = ratings.find(r => r.date === selectedDate);

    function handleMonthChange(month) {
        setCurrentMonth(month);
        setSelectedDate(month + '-01');
    }

    function handleDaySelect(date) {
        setSelectedDate(date);
    }

    function handleEntrySaved(saved) {
        setAllMonthEntries(prev => {
            const idx = prev.findIndex(e => e.id === saved.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
            }
            return [saved, ...prev];
        });
        setEditingEntry(null);
    }

    function handleEntryDeleted(id) {
        setAllMonthEntries(prev => prev.filter(e => e.id !== id));
        setEditingEntry(null);
    }

    async function handleRatingChange(value) {
        try {
            const updated = await api.ratings.upsert({ date: selectedDate, clientRating: value });
            setRatings(prev => {
                const idx = prev.findIndex(r => r.date === selectedDate);
                if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
                return [...prev, updated];
            });
        } catch (err) {
            console.error('Rating failed:', err);
        }
    }

    async function handleInviteTherapist() {
        setInviteLoading(true);
        try {
            const { link } = await api.relationships.createInvite('invite_therapist');
            setInviteLink(link);
            // Try to use Telegram share sheet
            if (window.Telegram?.WebApp?.openTelegramLink) {
                window.Telegram.WebApp.openTelegramLink(
                    `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my Emotional Journal as my therapist 🌿')}`
                );
            }
        } catch (err) {
            alert('Failed to generate invite: ' + err.message);
        } finally {
            setInviteLoading(false);
        }
    }

    async function handleDisconnect() {
        if (!therapist || !confirm('Disconnect from your therapist?')) return;
        try {
            await api.relationships.disconnect(therapist.relationshipId);
            setTherapist(null);
        } catch (err) {
            alert('Failed to disconnect: ' + err.message);
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
                    <h1>🌿 My Journal</h1>
                    <div className="header-subtitle">
                        {therapist ? `Connected with ${therapist.name}` : 'Personal journal'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle theme={theme} onChange={onThemeChange} telegramColorScheme={telegramColorScheme} />
                    <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">⚙️</button>
                </div>
            </header>

            <div className="page">
                {/* Calendar */}
                <div className="mt-4">
                    <Calendar
                        currentMonth={currentMonth}
                        onMonthChange={handleMonthChange}
                        onDaySelect={handleDaySelect}
                        selectedDate={selectedDate}
                        ratings={ratings}
                        entries={allMonthEntries}
                        forceCollapse={!!editingEntry}
                    />
                </div>


                {/* Entries for selected day */}
                <div className="section">
                    <div className="section-header">
                        <span className="section-title">
                            {selectedDate === today ? "Today's entries" : dateLabel}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">{dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}</span>
                            {dayEntries.length > 0 && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingEntry('new')}>+ Add entry</button>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-center mb-4">
                        <DayRating
                            value={dayRating?.clientRating || null}
                            onChange={handleRatingChange}
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
                            <h3>No entries yet</h3>
                            <button
                                className="btn btn-primary mt-4"
                                onClick={() => setEditingEntry('new')}
                            >
                                + Add entry
                            </button>
                        </div>
                    ) : (
                        dayEntries.map(entry => (
                            <EntryCard
                                key={entry.id}
                                entry={entry}
                                onClick={setEditingEntry}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Entry editor drawer */}
            {editingEntry && (
                <EntryEditor
                    entry={editingEntry === 'new' ? null : editingEntry}
                    date={selectedDate}
                    onSave={handleEntrySaved}
                    onClose={() => setEditingEntry(null)}
                    onDelete={handleEntryDeleted}
                />
            )}

            {/* Settings drawer */}
            {showSettings && (
                <NotificationSettings
                    onClose={() => setShowSettings(false)}
                    therapist={therapist}
                    onInviteTherapist={handleInviteTherapist}
                    inviteLink={inviteLink}
                    inviteLoading={inviteLoading}
                    onDisconnect={handleDisconnect}
                />
            )}
        </>
    );
}
