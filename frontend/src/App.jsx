import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import ClientView from './views/ClientView.jsx';
import TherapistView from './views/TherapistView.jsx';
import { getStoredTheme, applyTheme } from './components/ThemeToggle.jsx';
import { translations, getSystemLanguage } from './i18n.js';

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(getStoredTheme());
    const [lang, setLang] = useState(getSystemLanguage());
    const [telegramColorScheme, setTelegramColorScheme] = useState('light');

    // Translation helper
    const t = useCallback((key, ...args) => {
        const entry = translations[lang][key];
        if (typeof entry === 'function') return entry(...args);
        return entry || key;
    }, [lang]);

    const handleLangChange = (newLang) => {
        setLang(newLang);
        localStorage.setItem('ej-lang', newLang);
    };

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
            <div className="app-container">
                <div className="page flex items-center justify-center text-center" style={{ height: '100vh' }}>
                    <div>
                        <h2>{t('authFailed')}</h2>
                        <p className="text-muted">{t('openInTelegram')}</p>
                    </div>
                </div>
            </div>
        );
    }

    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;

    const commonProps = {
        startParam,
        theme,
        onThemeChange: setTheme,
        telegramColorScheme,
        lang,
        onLangChange: handleLangChange,
        t
    };

    return (
        <div className="app-container">
            {user.role === 'therapist'
                ? <TherapistView {...commonProps} />
                : <ClientView {...commonProps} />}
        </div>
    );
}
