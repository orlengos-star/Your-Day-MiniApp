import { useState, useEffect } from 'react';
import { api } from './api.js';
import ClientView from './views/ClientView.jsx';
import TherapistView from './views/TherapistView.jsx';
import { getStoredTheme, applyTheme } from './components/ThemeToggle.jsx';

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(getStoredTheme());
    const [telegramColorScheme, setTelegramColorScheme] = useState('light');

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            setTelegramColorScheme(tg.colorScheme || 'light');

            // Listen for theme changes from Telegram
            tg.onEvent('themeChanged', () => {
                setTelegramColorScheme(tg.colorScheme || 'light');
            });
        }

        // Load profile & role
        api.getProfile()
            .then(data => {
                setUser(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load profile:', err);
                setLoading(false);
            });
    }, []);

    // Apply theme whenever theme mode or Telegram color scheme changes
    useEffect(() => {
        applyTheme(theme, telegramColorScheme);
    }, [theme, telegramColorScheme]);

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="page flex items-center justify-center text-center" style={{ height: '100vh' }}>
                <div>
                    <h2>Authentication Failed</h2>
                    <p className="text-muted">Please open this app from the Telegram Bot chat.</p>
                </div>
            </div>
        );
    }

    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;

    const commonProps = {
        startParam,
        theme,
        onThemeChange: setTheme,
        telegramColorScheme
    };

    return (
        <div className="app-container">
            {user.role === 'therapist'
                ? <TherapistView {...commonProps} />
                : <ClientView {...commonProps} />}
        </div>
    );
}
