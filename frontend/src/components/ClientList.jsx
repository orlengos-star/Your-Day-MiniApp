import { useState } from 'react';

export default function ClientList({ clients, onSelectClient, onToggleArchive, onInviteClient, inviteLoading, inviteLink, t, lang }) {
    const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'archived'

    const filteredClients = clients.filter(c =>
        activeSubTab === 'active' ? !c.isArchived : !!c.isArchived
    );

    return (
        <div className="client-list-container">
            <div className="flex items-center justify-between mt-2 mb-4">
                <div className="flex gap-2 p-1 bg-surface-2 rounded-lg" style={{ width: 'fit-content' }}>
                    <button
                        className={`btn btn-sm ${activeSubTab === 'active' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveSubTab('active')}
                    >
                        {t('active')}
                    </button>
                    <button
                        className={`btn btn-sm ${activeSubTab === 'archived' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveSubTab('archived')}
                    >
                        {t('archived')}
                    </button>
                </div>

                <button
                    className="btn btn-primary btn-sm"
                    onClick={onInviteClient}
                    disabled={inviteLoading}
                >
                    {inviteLoading ? t('generating') : `+ ${t('inviteClient')}`}
                </button>
            </div>

            {inviteLink && (
                <div className="card mb-4" style={{ background: 'var(--brand-surface)', borderColor: 'var(--brand-soft)' }}>
                    <div className="text-xs text-muted mb-2">{t('copyInvite')}</div>
                    <div className="flex gap-2">
                        <div style={{
                            flex: 1,
                            background: 'var(--surface)',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            wordBreak: 'break-all',
                            color: 'var(--text-2)',
                            border: '1px solid var(--border)'
                        }}>
                            {inviteLink}
                        </div>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigator.clipboard?.writeText(inviteLink)}
                        >
                            📋
                        </button>
                    </div>
                </div>
            )}

            {filteredClients.length === 0 ? (
                <div className="empty-state mt-8">
                    <div className="empty-state-icon">👥</div>
                    <h3>{t('noClients')}</h3>
                    <p className="text-muted">{activeSubTab === 'active' ? t('inviteSub') : 'No archived clients found.'}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filteredClients.map(client => (
                        <div
                            key={client.id}
                            className="card clickable client-card"
                            onClick={() => onSelectClient(client)}
                            style={{ position: 'relative' }}
                        >
                            <div className="flex items-center justify-between">
                                <div style={{ flex: 1 }}>
                                    <div className="flex items-center gap-2">
                                        <h3 style={{ fontSize: '1rem', margin: 0 }}>{client.name || `Client #${client.id}`}</h3>
                                    </div>
                                    <div className="text-xs text-muted mt-1 truncate" style={{ maxWidth: '200px' }}>
                                        {client.professionalNote || (lang === 'ru' ? 'Заметок пока нет' : 'No notes yet')}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {client.unreadCount > 0 && (
                                        <span className="badge badge-primary" style={{ minWidth: '1.25rem', height: '1.25rem' }}>
                                            {client.unreadCount}
                                        </span>
                                    )}
                                    <div className="text-muted" style={{ fontSize: '1rem' }}>›</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
