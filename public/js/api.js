// Helper to always return response.data or error.response.data, or throw error
async function handleApiRequest(fn) {
    try {
        const response = await fn();
        if (response.data) return response.data;
        throw new Error('No response data');
    } catch (error) {
        if (error.response && error.response.data) return error.response.data;
        throw error;
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
        logout: async () => {
            const token = localStorage.getItem('token');
            return handleApiRequest(async () => {
                const response = await axios.post('/api/auth/logout', {}, { headers: { Authorization: token } });
                if (response.success)
                    localStorage.removeItem('token');
                return response;
            });
        },
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
        create: (event) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/events/create', event, { headers: { Authorization: token } }));
        },
        update: (event) => {
            const token = localStorage.getItem('token');
            return handleApiRequest(() => axios.post('/api/events/update', event, { headers: { Authorization: token } }));
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