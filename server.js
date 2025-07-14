const express = require('express');
const app = express();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('./config.json');

const isEmailValid = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Map user IDs to user info
const users = {};

// Map session tokens to user IDs
const sessions = {};

// Map event IDs to event details
const events = {};

// Use Express' built-in JSON parser
app.use(express.json());

// Middleware for logging and utility functions
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`${ip} ${req.method} ${req.url}`);
    res.sendApiError = (status, code, message) => {
        res.status(status).json({ success: false, code, message });
    };
    res.sendApiOkay = (data = {}) => {
        res.json({ success: true, ...data });
    };
    next();
});

// Serve static files from the public directory
app.use(express.static('public'));

// Create new account
// Accounts should be stored in an in-memory object for now
app.post('/api/auth/register', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    if (!isEmailValid(email)) {
        return res.sendApiError(400, 'invalid_email', 'Email address is not valid');
    }
    if (password.length < 8) {
        return res.sendApiError(400, 'weak_password', 'Password must be at least 8 characters long');
    }
    for (const userId in users) {
        if (users[userId].email.toLowerCase() === email.toLowerCase()) {
            return res.sendApiError(400, 'email_in_use', 'An account with that email address already exists');
        }
    }
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    users[userId] = {
        email, passwordHash,
        profile: {
            name: '',
            addressLine1: '',
            addressLine2: '',
            city: '',
            state: '',
            zip: '',
            skills: [],
            preference: '',
            availability_dates: []
        }
    };
    console.log(`Created user ${userId} (${email})`);
});

// Log into account with username/email and password, returns a session token
// Sessions should be stored in an in-memory object for now
app.post('/api/auth/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    // check password, create and save token
});

// Middleware to check for valid session token and error out if not valid or present
const requireLogin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.sendApiError(401, 'missing_token', 'Authorization token is required');
    }
    const userId = sessions[token];
    if (!userId) {
        return res.sendApiError(401, 'invalid_token', 'Authorization token is invalid or expired');
    }
    req.userId = userId;
    req.user = users[userId];
    if (!req.user) {
        return res.sendApiError(500, 'user_not_found', 'User not found for the given token');
    }
    next();
};

// Log out and delete the current session token
app.post('/api/auth/logout', requireLogin, (req, res) => { });

// Get current user profile info
app.get('/api/profile', requireLogin, (req, res) => { });

// Update current user profile info
app.post('/api/profile/update', requireLogin, (req, res) => { });

// Get events assigned to the current user
app.post('/api/profile/events', requireLogin, (req, res) => { });

// Get all events (admin only)
app.get('/api/events', requireLogin, (req, res) => { });

// Get a single event (admin only)
app.get('/api/events/event', requireLogin, (req, res) => { });

// Create new event (admin only)
app.post('/api/events/create', requireLogin, (req, res) => { });

// Update existing event info (admin only)
app.post('/api/events/update', requireLogin, (req, res) => { });

// Get volunteers that are available for a certain event (admin only)
app.get('/api/events/match/check', requireLogin, (req, res) => { });

// Assign a volunteer to an event (admin only)
app.post('/api/events/match/assign', requireLogin, (req, res) => { });

// Get notifications for the current user
app.get('/api/notifications', requireLogin, (req, res) => { });

// Get volunteer history (maybe admin only?)
app.get('/api/history', requireLogin, (req, res) => { });

// Catch-all route to serve the index.html file for any unmatched routes
app.use((req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start the server
app.listen(config.server_port, () => {
    console.log(`Server is running at http://localhost:${config.server_port}`);
});