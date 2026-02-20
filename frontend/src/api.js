/**
 * API client — wraps fetch with Telegram initData auth header.
 * In development, uses a mock user header instead.
 */

const BASE = '/api';

function getAuthHeaders() {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
        return { 'x-telegram-init-data': tg.initData };
    }
    // Dev fallback: mock user (replace with your Telegram ID for local testing)
    return {
        'x-dev-user': JSON.stringify({
            id: 12345678,
            first_name: 'Dev',
            last_name: 'User',
            username: 'devuser',
        }),
    };
}

async function request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ── Journal Entries ───────────────────────────────────────────────────────────
export const api = {
    getProfile: () => request('GET', '/me'),
    entries: {
        list: (params = {}) => {
            const q = new URLSearchParams(params).toString();
            return request('GET', `/entries${q ? '?' + q : ''}`);
        },
        get: (id) => request('GET', `/entries/${id}`),
        create: (body) => request('POST', '/entries', body),
        update: (id, body) => request('PUT', `/entries/${id}`, body),
        delete: (id) => request('DELETE', `/entries/${id}`),
    },

    ratings: {
        list: (params = {}) => {
            const q = new URLSearchParams(params).toString();
            return request('GET', `/ratings${q ? '?' + q : ''}`);
        },
        upsert: (body) => request('POST', '/ratings', body),
    },

    relationships: {
        createInvite: (inviteType) => request('POST', '/relationships/invite', { inviteType }),
        getClients: () => request('GET', '/relationships/clients'),
        getTherapist: () => request('GET', '/relationships/therapist'),
        disconnect: (id) => request('DELETE', `/relationships/${id}`),
    },

    notifications: {
        getSettings: () => request('GET', '/notifications/settings'),
        updateSettings: (body) => request('PUT', '/notifications/settings', body),
    },
};
