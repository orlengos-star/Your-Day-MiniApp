import { useState, useEffect } from 'react';

const RATINGS = [
    { value: 1, emoji: '😔', label: 'Negative', color: 'var(--rating-1)' },
    { value: 2, emoji: '😕', label: 'Low', color: 'var(--rating-2)' },
    { value: 3, emoji: '😐', label: 'Neutral', color: 'var(--rating-3)' },
    { value: 4, emoji: '🙂', label: 'Good', color: 'var(--rating-4)' },
    { value: 5, emoji: '😊', label: 'Positive', color: 'var(--rating-5)' },
];

export default function DayRating({ value, onChange, label = 'How was your day?', readOnly = false }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-collapse when value is selected from outside or internally
    useEffect(() => {
        setIsExpanded(false);
    }, [value]);

    const selectedRating = RATINGS.find(r => r.value === value);

    const handleRatingSelect = (val) => {
        if (readOnly) return;
        onChange(val);
        setIsExpanded(false);
    };

    return (
        <div className={`rating-capsule ${isExpanded ? 'is-expanded' : ''}`}>
            {!isExpanded ? (
                <button
                    className="capsule-trigger"
                    onClick={() => !readOnly && setIsExpanded(true)}
                    disabled={readOnly}
                >
                    {selectedRating ? (
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{selectedRating.emoji}</span>
                            <span className="font-medium text-sm">Feeling {selectedRating.label}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-muted">
                            <span className="text-sm">Rate your day</span>
                            <span className="text-xs">➕</span>
                        </div>
                    )}
                </button>
            ) : (
                <div className="rating-options">
                    {RATINGS.map(r => (
                        <button
                            key={r.value}
                            className={`rating-circle ${value === r.value ? 'is-active' : ''}`}
                            style={{ backgroundColor: r.color }}
                            onClick={() => handleRatingSelect(r.value)}
                            aria-label={r.label}
                            title={r.label}
                        >
                            <span className="rating-circle-emoji">{r.emoji}</span>
                        </button>
                    ))}
                    <button
                        className="rating-cancel"
                        onClick={() => setIsExpanded(false)}
                        aria-label="Cancel"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}
