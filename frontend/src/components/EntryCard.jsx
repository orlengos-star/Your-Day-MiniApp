export default function EntryCard({ entry, onClick, isTherapist = false, t, lang }) {
    const time = new Date(entry.createdAt).toLocaleTimeString(lang === 'ru' ? 'ru' : 'en-GB', {
        hour: '2-digit', minute: '2-digit'
    });

    return (
        <div
            className={`entry-card ${entry.isHighlighted ? 'highlighted' : ''}`}
            onClick={() => onClick(entry)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onClick(entry)}
        >
            <div className="entry-time">{time}</div>
            <div className="entry-text">{entry.text}</div>

            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: entry.isHighlighted || (isTherapist && entry.therapistComments) ? '0.5rem' : 0 }}>
                {entry.isHighlighted && (
                    <span className="entry-badge highlighted">⭐ {t('highlightedBadge')}</span>
                )}
                {isTherapist && entry.therapistComments && (
                    <span className="entry-badge has-notes">📝 {t('hasNotes')}</span>
                )}
            </div>
        </div>
    );
}
