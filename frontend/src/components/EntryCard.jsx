export default function EntryCard({ entry, onClick, isTherapist = false }) {
    const time = new Date(entry.createdAt).toLocaleTimeString('en-GB', {
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
                    <span className="entry-badge highlighted">⭐ Highlighted</span>
                )}
                {isTherapist && entry.therapistComments && (
                    <span className="entry-badge has-notes">📝 Has notes</span>
                )}
            </div>
        </div>
    );
}
