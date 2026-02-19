const RATINGS = [
    { value: 1, emoji: '😔', label: 'Negative' },
    { value: 2, emoji: '😕', label: 'Low' },
    { value: 3, emoji: '😐', label: 'Neutral' },
    { value: 4, emoji: '🙂', label: 'Good' },
    { value: 5, emoji: '😊', label: 'Positive' },
];

export default function DayRating({ value, onChange, label = 'How was your day?', readOnly = false }) {
    return (
        <div>
            {label && (
                <div className="section-title" style={{ marginBottom: '0.75rem' }}>{label}</div>
            )}
            <div className="rating-widget">
                {RATINGS.map(r => (
                    <button
                        key={r.value}
                        className={`rating-btn ${value === r.value ? 'selected' : ''}`}
                        onClick={() => !readOnly && onChange(r.value)}
                        disabled={readOnly}
                        aria-label={r.label}
                        aria-pressed={value === r.value}
                    >
                        <span className="rating-emoji">{r.emoji}</span>
                        <span className="rating-label">{r.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
