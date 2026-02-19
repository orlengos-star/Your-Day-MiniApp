import { useState, useEffect } from 'react';
import { api } from './api.js';
import ClientView from './views/ClientView.jsx';
import TherapistView from './views/TherapistView.jsx';
import { getStoredTheme, applyTheme } from './components/ThemeToggle.jsx';

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [startParam, setStartParam] = useState(null);
    const [theme, setTheme] = useState(() => getStoredTheme());
    const [tgColorScheme, setTgColorScheme] = useState('light');

    // Apply theme whenever mode or Telegram color scheme changes
    useEffect(() => {
        applyTheme(theme, tgColorScheme);
    }, [theme, tgColorScheme]);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();

            setTgColorScheme(tg.colorScheme || 'light');

            // When Telegram theme changes, re-apply (only matters in 'auto' mode)
            tg.onEvent('themeChanged', () => {
                setTgColorScheme(tg.colorScheme || 'light');
            });

            const sp = tg.initDataUnsafe?.start_param;
            if (sp) setStartParam(sp);
        }

        api.entries.list({ month: new Date().toISOString().slice(0, 7) })
            .then(() => {
                return api.relationships.getClients()
                    .then(clients => {
                        return api.relationships.getTherapist().then(() => {
                            setUser({ role: clients.length > 0 ? 'therapist' : 'client' });
                        });
                    })
                    .catch(() => setUser({ role: 'client' }));
            })
            .catch(() => setUser({ role: 'client' }))
            .finally(() => setLoading(false));
    }, []);

    function handleThemeChange(newTheme) {
        setTheme(newTheme);
        // localStorage is already saved inside ThemeToggle
    }

    if (loading) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌿</div>
                    <p style={{ fontSize: '0.875rem' }}>Loading your journal…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                <div className="empty-state">
                    <div className="empty-state-icon">⚠️</div>
                    <h3>Something went wrong</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {user?.role === 'therapist'
                ? <TherapistView startParam={startParam} theme={theme} onThemeChange={handleThemeChange} />
                : <ClientView startParam={startParam} theme={theme} onThemeChange={handleThemeChange} />
            }
        </div>
    );
}
