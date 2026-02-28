import { useState } from 'react';
import { api } from '../api.js';

export default function TherapistNotes({ entry, onUpdate, t }) {
    const [notes, setNotes] = useState(entry.therapistComments || '');
    const [highlighted, setHighlighted] = useState(!!entry.isHighlighted);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await api.entries.update(entry.id, {
                therapistComments: notes,
                isHighlighted: highlighted,
            });
            onUpdate(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            alert(t('errorSaveNote'));
        } finally {
            setSaving(false);
        }
    }

    async function toggleHighlight() {
        const newVal = !highlighted;
        setHighlighted(newVal);
        try {
            const updated = await api.entries.update(entry.id, { isHighlighted: newVal });
            onUpdate(updated);
        } catch {
            setHighlighted(!newVal); // revert
        }
    }

    return (
        <div className="therapist-notes-section">
            <div className="therapist-notes-label">
                🔒 {t('therapistComments')}
            </div>

            <textarea
                className="textarea"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('addComment')}
                rows={3}
                style={{ minHeight: '80px', fontSize: '0.875rem', background: 'transparent', border: '1px solid #FFE0B2' }}
            />

            <div className="flex items-center justify-between mt-2">
                <button
                    className={`btn btn-sm ${highlighted ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={toggleHighlight}
                    style={{ fontSize: '0.75rem' }}
                >
                    {highlighted ? `⭐ ${t('highlightEntry')}` : `☆ ${t('highlightEntry')}`}
                </button>

                <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ fontSize: '0.75rem' }}
                >
                    {saving ? t('saving') : saved ? `✓ ${t('save')}` : t('save')}
                </button>
            </div>
        </div>
    );
}
