const express = require('express');
const app = express();

// Use Express' built-in JSON parser
app.use(express.json());

// Create new account
app.post('/api/auth/register', (req, res) => { });

// Log into account with username/email and password, returns a session token
app.post('/api/auth/login', (req, res) => { });

// Log out and delete the current session token
app.post('/api/auth/logout', (req, res) => { });

// Get current user profile info
app.get('/api/profile', (req, res) => { });

// Update current user profile info
app.post('/api/profile/update', (req, res) => { });

// Get events assigned to the current user
app.post('/api/profile/events', (req, res) => { });

// Get all events (admin only)
app.get('/api/events', (req, res) => { });

// Create new event (admin only)
app.post('/api/events/create', (req, res) => { });

// Update existing event info (admin only)
app.post('/api/events/update', (req, res) => { });

// Get volunteers that are available for a certain event (admin only)
app.get('/api/events/match/check', (req, res) => { });

// Assign a volunteer to an event (admin only)
app.post('/api/events/match/assign', (req, res) => { });

// Get notifications for the current user
app.get('/api/notifications', (req, res) => { });

// Get volunteer history (maybe admin only?)
app.get('/api/history', (req, res) => { });

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