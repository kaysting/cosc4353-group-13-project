const express = require('express');
const app = express();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Map user IDs to user info
const users = {};

// Map session tokens to user IDs
const sessions = {};

// Use Express' built-in JSON parser
app.use(express.json());

// Create new account
// Accounts should be stored in an in-memory object for now
app.post('/api/auth/register', (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
});

// Log into account with username/email and password, returns a session token
// Sessions should be stored in an in-memory object for now
app.post('/api/auth/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
});

// Middleware to check for valid session token and error out if not valid or present
const requireLogin = (req, res, next) => {
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

// Serve static files from the public directory
app.use(express.static('public'));

// Catch-all route to serve the index.html file for any unmatched routes
app.use((req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});