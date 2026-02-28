import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

export default function ClientProfileCard({ client, onUpdate, onArchiveToggle, t, lang }) {
    const [bio, setBio] = useState(client.bio || '');
    const [sessionNotes, setSessionNotes] = useState(client.sessionNotes || '');
    const [saving, setSaving] = useState(false);
    const [bioExpanded, setBioExpanded] = useState(false);
    const saveTimeout = useRef(null);

    // Sync state if client prop changes (e.g., selecting a new client)
    useEffect(() => {
        setBio(client.bio || '');
        setSessionNotes(client.sessionNotes || '');
        setBioExpanded(false); // Reset expansion state
    }, [client.id, client.bio, client.sessionNotes]);

    const handleTextChange = (field, value) => {
        if (field === 'bio') setBio(value);
        if (field === 'sessionNotes') setSessionNotes(value);

        setSaving(true);
        if (saveTimeout.current) clearTimeout(saveTimeout.current);

        saveTimeout.current = setTimeout(async () => {
            try {
                const nextBio = field === 'bio' ? value : bio;
                const nextSessionNotes = field === 'sessionNotes' ? value : sessionNotes;
                await api.relationships.updateNotes(client.id, { bio: nextBio, sessionNotes: nextSessionNotes });
                onUpdate(client.id, { bio: nextBio, sessionNotes: nextSessionNotes });
                setSaving(false);
            } catch (err) {
                console.error('Failed to save notes:', err);
                setSaving(false);
            }
        }, 1000); // 1s debounce
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Session Notes Section */}
            <section className="card" style={{ borderColor: 'var(--primary)', borderWidth: '2px', borderStyle: 'solid' }}>
                <div className="flex items-center justify-between mb-3">
                    <h3 style={{ margin: 0 }}>📋 {t('nextSessionNotes') || (lang === 'ru' ? 'Заметки к следующей сессии' : 'Next Session Notes')}</h3>
                    {saving && <span className="text-xs text-muted animate-pulse">{t('saving') || (lang === 'ru' ? 'Сохранение...' : 'Saving...')}</span>}
                </div>
                <textarea
                    className="textarea w-full"
                    placeholder={t('sessionNotesPlaceholder') || (lang === 'ru' ? 'О чем вы хотите поговорить на следующей сессии?' : 'What do you want to discuss next session?')}
                    value={sessionNotes}
                    onChange={(e) => handleTextChange('sessionNotes', e.target.value)}
                    style={{ minHeight: '180px' }}
                />
            </section>

            {/* Unfoldable BIO Section */}
            <section className="card pb-2">
                <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setBioExpanded(!bioExpanded)}
                    style={{ paddingBottom: bioExpanded ? '0.75rem' : '0' }}
                >
                    <h3 style={{ margin: 0, opacity: bioExpanded ? 1 : 0.8 }}>📁 {t('clientBio') || (lang === 'ru' ? 'Карточка клиента (BIO)' : 'Client Background (BIO)')}</h3>
                    <button className="icon-btn text-muted" aria-label="Toggle BIO">
                        {bioExpanded ? '▲' : '▼'}
                    </button>
                </div>

                {bioExpanded && (
                    <div className="mt-2 animate-fade-in">
                        <textarea
                            className="textarea w-full"
                            placeholder={t('bioPlaceholder') || (lang === 'ru' ? 'Долгосрочная информация, история, диагнозы...' : 'Long-term history, diagnoses, context...')}
                            value={bio}
                            onChange={(e) => handleTextChange('bio', e.target.value)}
                            style={{ minHeight: '120px', fontSize: '0.9rem' }}
                        />
                    </div>
                )}
            </section>

            {/* Settings & Info Section */}
            <div className="card">
                <div className="settings-row">
                    <div>
                        <div className="settings-label">{t('connectedDate')}</div>
                        <div className="settings-sublabel">
                            {client.connectedAt ? new Date(client.connectedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB') : '-'}
                        </div>
                    </div>
                </div>
                <div className="settings-row mt-3">
                    <div>
                        <div className="settings-label">{t('archiveClient')}</div>
                        <div className="settings-sublabel">{t('archiveClientSub')}</div>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onArchiveToggle(client.relationshipId, !client.isArchived)}
                    >
                        {client.isArchived ? t('unarchive') : t('archive')}
                    </button>
                </div>
            </div>
        </div>
    );
}
