import { useState, useRef, useEffect } from 'react';
import { api } from '../api.js';

export default function EntryEditor({ entry, date, onSave, onClose, onDelete }) {
    const [text, setText] = useState(entry?.text || '');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const textareaRef = useRef(null);
    const isNew = !entry;

    useEffect(() => {
        textareaRef.current?.focus();
        // Auto-resize
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
    }, []);

    function handleTextChange(e) {
        setText(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    }

    async function handleSave() {
        if (!text.trim()) return;
        setSaving(true);
        try {
            let saved;
            if (isNew) {
                saved = await api.entries.create({ text: text.trim(), entryDate: date });
            } else {
                saved = await api.entries.update(entry.id, { text: text.trim() });
            }
            onSave(saved);
        } catch (err) {
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!confirmDelete) { setConfirmDelete(true); return; }
        setDeleting(true);
        try {
            await api.entries.delete(entry.id);
            onDelete(entry.id);
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        } finally {
            setDeleting(false);
        }
    }

    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    return (
        <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="drawer">
                <div className="drawer-handle" />

                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3>{isNew ? 'New Entry' : 'Edit Entry'}</h3>
                        <div className="text-xs text-muted mt-1">{dateLabel}</div>
                    </div>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <textarea
                    ref={textareaRef}
                    className="textarea"
                    value={text}
                    onChange={handleTextChange}
                    placeholder="What's on your mind today? Write freely…"
                    rows={5}
                    style={{ minHeight: '140px' }}
                />

                <div className="text-xs text-muted mt-1" style={{ textAlign: 'right' }}>
                    {text.length} characters
                </div>

                <div className="flex gap-2 mt-4">
                    {!isNew && (
                        <button
                            className={`btn btn-danger btn-sm ${confirmDelete ? '' : ''}`}
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? '…' : confirmDelete ? 'Confirm delete' : '🗑'}
                        </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginLeft: !isNew ? 0 : 'auto' }}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSave}
                        disabled={!text.trim() || saving}
                    >
                        {saving ? 'Saving…' : isNew ? 'Save entry' : 'Update'}
                    </button>
                </div>
            </div>
        </div>
    );
}
