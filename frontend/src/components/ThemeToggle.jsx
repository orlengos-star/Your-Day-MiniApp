const STORAGE_KEY = 'ej-theme';

export function getStoredTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'auto';
}

export function applyTheme(mode, telegramColorScheme) {
    const root = document.documentElement;
    const effectiveDark =
        mode === 'dark' ||
        (mode === 'auto' && (telegramColorScheme === 'dark' ||
            window.matchMedia?.('(prefers-color-scheme: dark)').matches));

    if (effectiveDark) {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
}

export default function ThemeToggle({ theme, onChange, telegramColorScheme }) {
    // Determine the current visual state. 
    // If auto, we look at the telegramColorScheme or system pref.
    const isActuallyDark =
        theme === 'dark' ||
        (theme === 'auto' && (telegramColorScheme === 'dark' ||
            window.matchMedia?.('(prefers-color-scheme: dark)').matches));

    function handleToggle() {
        const newTheme = isActuallyDark ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, newTheme);
        onChange(newTheme);
    }

    return (
        <label className="theme-toggle" title={`Currently ${theme} mode`}>
            <input
                type="checkbox"
                checked={isActuallyDark}
                onChange={handleToggle}
                aria-label="Toggle dark mode"
            />
            <div className="theme-toggle-slider">
                <span className="sun-icon">☀️</span>
                <span className="moon-icon">🌙</span>
                <div className="toggle-knob" />
            </div>
        </label>
    );
}
