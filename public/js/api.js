// Helper to always return response.data or error.response.data, or error object
async function handleApiRequest(fn) {
    try {
        const response = await fn();
        if (response.data) return response.data;
        return { success: false, code: 'axios_error', message: 'No response data' };
    } catch (error) {
        if (error.response && error.response.data) return error.response.data;
        return {
            success: false,
            code: 'axios_error',
            message: error && error.toString ? error.toString() : 'Unknown error'
        };
    }
}

const api = {
    auth: {
        register: (email, password) => handleApiRequest(() => axios.post('/api/auth/register', { email, password })),
        login: async (email, password) => {
            return handleApiRequest(async () => {
                const response = await axios.post('/api/auth/login', { email, password });
                if (response.data && response.data.token) {
                    localStorage.setItem('token', response.data.token);
                }
                return response;
            });
        },
        getCurrentUser: async () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/auth/me', { headers: { Authorization: token } }));
        },
        logout: async () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(async () => {
                const response = await axios.post('/api/auth/logout', {}, { headers: { Authorization: token } });
                if (response.success)
                    localStorage.removeItem('token');
                return response;
            });
        },
        // Add email verification API call
        verifyEmail: (userId, email, code) => {
            return handleApiRequest(() => axios.post('/api/auth/verify-email', { userId, email, code }));
        }
    },
    profile: {
        get: () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/profile', { headers: { Authorization: token } }));
        },
        update: (profile) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/profile/update', profile, { headers: { Authorization: token } }));
        },
        events: () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/profile/events', {}, { headers: { Authorization: token } }));
        }
    },
    events: {
        getAll: () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/events', { headers: { Authorization: token } }));
        },
        get: (eventId) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/events/event', { params: { eventId }, headers: { Authorization: token } }));
        },
        create: (eventInfo) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/events/create', eventInfo, { headers: { Authorization: token } }));
        },
        update: (eventInfo) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/events/update', eventInfo, {headers: { Authorization: token }}));
        },
        delete: (eventId) => { // NEW
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/events/delete', { id: eventId }, { headers: { Authorization: token } }));
        },
        matchCheck: (eventId) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/events/match/check', { params: { eventId }, headers: { Authorization: token } }));
        },
        matchAssign: (eventId, volunteerId) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/events/match/assign', { eventId, volunteerId }, { headers: { Authorization: token } }));
        }
    },
    notifications: {
        get: () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/notifications', { headers: { Authorization: token } }));
        }
    },
    history: {
        get: () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.get('/api/history', { headers: { Authorization: token } }));
        }
    }
};