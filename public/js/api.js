const api = {
    auth: {
        register: async (email, password) => {
            return axios.post('/api/auth/register', { email, password });
        },
        login: async (email, password) => {
            const response = await axios.post('/api/auth/login', { email, password });
            if (response.data && response.data.token) {
                localStorage.setItem('token', response.data.token);
            }
            return response;
        },
        logout: async () => {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/auth/logout', {}, { headers: { Authorization: token } });
            localStorage.removeItem('token');
            return res;
        },
    },
    profile: {
        get: async () => {
            const token = localStorage.getItem('token');
            return axios.get('/api/profile', { headers: { Authorization: token } });
        },
        update: async (profile) => {
            const token = localStorage.getItem('token');
            return axios.post('/api/profile/update', profile, { headers: { Authorization: token } });
        },
        events: async () => {
            const token = localStorage.getItem('token');
            return axios.post('/api/profile/events', {}, { headers: { Authorization: token } });
        }
    },
    events: {
        getAll: async () => {
            const token = localStorage.getItem('token');
            return axios.get('/api/events', { headers: { Authorization: token } });
        },
        get: async (eventId) => {
            const token = localStorage.getItem('token');
            return axios.get('/api/events/event', { params: { eventId }, headers: { Authorization: token } });
        },
        create: async (event) => {
            const token = localStorage.getItem('token');
            return axios.post('/api/events/create', event, { headers: { Authorization: token } });
        },
        update: async (event) => {
            const token = localStorage.getItem('token');
            return axios.post('/api/events/update', event, { headers: { Authorization: token } });
        },
        matchCheck: async (eventId) => {
            const token = localStorage.getItem('token');
            return axios.get('/api/events/match/check', { params: { eventId }, headers: { Authorization: token } });
        },
        matchAssign: async (eventId, volunteerId) => {
            const token = localStorage.getItem('token');
            return axios.post('/api/events/match/assign', { eventId, volunteerId }, { headers: { Authorization: token } });
        }
    },
    notifications: {
        get: async () => {
            const token = localStorage.getItem('token');
            return axios.get('/api/notifications', { headers: { Authorization: token } });
        }
    },
    history: {
        get: async () => {
            const token = localStorage.getItem('token');
            return axios.get('/api/history', { headers: { Authorization: token } });
        }
    }
};