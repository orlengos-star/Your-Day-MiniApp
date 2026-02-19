const STORAGE_KEY = 'ej-theme';

// Modes: 'light' | 'dark' | 'auto'
const ICONS = { light: '☀️', dark: '🌙', auto: '⚙️' };
const LABELS = { light: 'Light', dark: 'Dark', auto: 'Auto' };
const CYCLE = { light: 'dark', dark: 'auto', auto: 'light' };

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

export default function ThemeToggle({ theme, onChange }) {
    const next = CYCLE[theme] || 'auto';

    function handleClick() {
        const newTheme = next;
        localStorage.setItem(STORAGE_KEY, newTheme);
        onChange(newTheme);
    }

    return (
        <button
            className="icon-btn theme-toggle-btn"
            onClick={handleClick}
            aria-label={`Theme: ${LABELS[theme]}. Click to switch to ${LABELS[next]}`}
            title={`${LABELS[theme]} mode — click to switch`}
        >
            <span className="theme-toggle-icon">{ICONS[theme]}</span>
        </button>
    );
}
