const express = require('express');
const app = express();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const config = require('./config.json');

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'api',
    key: config.mailgun_api_key
});

const isEmailValid = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isZipValid = zip => /^\d{5}$/.test(zip);
const isDateValid = date => !isNaN(Date.parse(date));

const randomString = (length, charset = 'base64') => {
    let result = '';
    if (charset == 'hex')
        charset = '0123456789abcdef';
    else if (charset == 'numeric')
        charset = '0123456789';
    else if (charset == 'base64')
        charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
};

const hashPassword = async (password) => {
    return bcrypt.hash(password, 10);
};

const checkPassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// In-memory data maps to act as database for now
const users = {};
const sessions = {};
const events = {};
const notifications = {};
const volunteerHistory = {};
const eventAssignments = {};
const emailVerificationCodes = {};

// Create temporary admin user
(async () => {
    const adminUserId = randomString(8, 'hex');
    const adminUserEmail = 'admin@example.com';
    const adminUserPassword = 'adminpassword';
    users[adminUserId] = {
        email: adminUserEmail,
        password_hash: await hashPassword(adminUserPassword),
        is_email_verified: true,
        is_admin: true,
        profile: {
            name: 'Admin User',
            address_line1: '',
            address_line2: '',
            city: '',
            state: '',
            zip: '',
            skills: [],
            preference: '',
            availability_dates: []
        }
    };
    console.log(`Created temp admin user with ID: ${adminUserId}, Email: ${adminUserEmail}, Password: ${adminUserPassword}`);
})();

// Function to send notifications to users
// Stores notifications in the database and sends an email
const sendNotification = (recipientId, header, description, time = Date.now()) => {
    // ...
};

const sendEmail = async (senderName, to, subject, text) => {
    const data = {
        from: `${senderName} <no-reply@${config.mailgun_domain}>`,
        to,
        subject,
        text
    };
    await mg.messages.create(config.mailgun_domain, data);
};

const sendVerificationEmail = async (email) => {
    const code = randomString(6, 'numeric');
    emailVerificationCodes[code] = email;
    console.log(`Generated email verification code ${code} for ${email}`);
    await sendEmail(
        'Volunteer Platform',
        email,
        'Verify your email',
        `Hey new volunteer!\n\nTo keep your account safe, please verify your email address by entering the code below on the website:\n\n${code}\n\nIf you did not create an account, please ignore this email.\n\nThanks!`
    );
};

// Function to add a volunteer history entry
const addVolunteerHistory = (userId, eventId) => {
    // ...
};

// Use Express' built-in JSON parser
app.use(express.json());

// Middleware for logging and utility functions
app.use((req, res, next) => {
    res.on('finish', () => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`${ip} ${req.method} ${res.statusCode} ${req.url}`);
    });
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
    const passwordHash = await hashPassword(password);
    users[userId] = {
        email, password_hash: passwordHash,
        is_email_verified: false,
        is_admin: false,
        profile: {
            name: '',
            address_line1: '',
            address_line2: '',
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
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!isEmailValid(email)) {
        return res.sendApiError(400, 'invalid_email', 'Email address is not valid');
    }
    let userId = null;
    let user = null;
    for (const id in users) {
        if (users[id].email.toLowerCase() === email.toLowerCase()) {
            userId = id;
            user = users[id];
            break;
        }
    }
    if (!user) {
        return res.sendApiError(401, 'invalid_credentials', 'Invalid email or password');
    }
    const valid = await checkPassword(password, user.password_hash);
    if (!valid) {
        return res.sendApiError(401, 'invalid_credentials', 'Invalid email or password');
    }
    const token = randomString(64, 'base64');
    sessions[token] = userId;
    res.sendApiOkay({ token });
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
app.get('/api/profile', requireLogin, (req, res) => {
    const profile = req.user.profile;
    res.sendApiOkay({ profile });
});

// Update current user profile info
app.post('/api/profile/update', requireLogin, (req, res) => {
    const {
        name,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        skills,
        preference,
        availability_dates
    } = req.body;
    //Make sure zip code is of 5 char length 
    if (zip && !isZipValid(zip)) {
        return res.sendApiError(400, 'invalid_zip', 'Zip code must be 5 digits');
    }
    // Validate all availability_dates
    if (availability_dates && Array.isArray(availability_dates)) {
        for (const date of availability_dates) {
            if (!isDateValid(date)) {
                return res.sendApiError(400, 'invalid_date', `Invalid date in availability_dates: ${date}`);
            }
        }
    }
    //Update the User Profile
    req.user.profile = {
        name,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        skills: Array.isArray(skills) ? skills : [],
        preference,
        availability_dates: Array.isArray(availability_dates) ? availability_dates : []
    };
    res.sendApiOkay({ message: 'Profile updated successfully!' });
});

// Get events assigned to the current user
app.post('/api/profile/events', requireLogin, (req, res) => { });

// Get all events (admin only)
app.get('/api/events', requireLogin, (req, res) => { });

// Get a single event (admin only)
app.get('/api/events/event', requireLogin, (req, res) => { });

// Create new event (admin only)
app.post('/api/events/create', requireLogin, (req, res) => {
    const { name, description, location, skills, urgency, date } = req.body;

    if (!name || !description || !location || !Array.isArray(skills) || !urgency || !date) {
        return res.sendApiError(400, 'invalid_input', 'All fields are required and must be valid.');
    }

    const eventId = crypto.randomUUID(); // generate unique event ID
    events[eventId] = {
        id: eventId,
        name,
        description,
        location,
        skills,
        urgency,
        date,
        createdBy: req.userId
    };

    console.log(`Created event ${eventId}: ${name}`);
    res.sendApiOkay({ event: events[eventId] });
});

// Update existing event info (admin only)
app.post('/api/events/update', requireLogin, (req, res) => {
    const { eventId, name, description, location, skills, urgency, date } = req.body;

    const event = events[eventId];
    if (!event) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    // Update event details
    event.name = name;
    event.description = description;
    event.location = location;
    event.skills = skills;
    event.urgency = urgency;
    event.date = date;

    res.sendApiOkay({ event });
});

// Get volunteers that are available for a certain event (admin only)
app.get('/api/events/match/check', requireLogin, (req, res) => {
    const eventId = req.query.eventId;
    const event = events[eventId];

    if (!event) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    const matchingVolunteers = [];

    for (const userId in users) {
        const user = users[userId];
        const profile = user.profile;

        if (eventAssignments[eventId] && eventAssignments[eventId].includes(userId)) {
            continue;
        }

        const hasRequiredSkills = event.requiredSkills.some(skill =>
            profile.skills.includes(skill)
        );

        const isAvailable = profile.availability_dates.includes(event.date);

        const locationMatch = profile.city && profile.state &&
            event.location.includes(profile.city) &&
            event.location.includes(profile.state);

        if (hasRequiredSkills && isAvailable && locationMatch) {
            matchingVolunteers.push({
                userId: userId,
                name: profile.name || user.email,
                email: user.email,
                skills: profile.skills,
                location: `${profile.city}, ${profile.state}`
            });
        }
    }

    res.sendApiOkay({ volunteers: matchingVolunteers });
});

// Assign a volunteer to an event (admin only)
app.post('/api/events/match/assign', requireLogin, (req, res) => {
    const { eventId, volunteerId } = req.body;

    if (!volunteerId) {
        return res.sendApiError(400, 'missing_volunteer', 'Volunteer ID is required');
    }

    const event = events[eventId];
    if (!event) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    const volunteer = users[volunteerId];
    if (!volunteer) {
        return res.sendApiError(404, 'volunteer_not_found', 'Volunteer not found');
    }

    if (!eventAssignments[eventId]) {
        eventAssignments[eventId] = [];
    }

    if (eventAssignments[eventId].includes(volunteerId)) {
        return res.sendApiError(400, 'already_assigned', 'Volunteer is already assigned to this event');
    }

    eventAssignments[eventId].push(volunteerId);

    // Send notification to volunteer about assignment
    sendNotification(volunteerId, {
        type: 'assignment',
        message: `You have been assigned to "${event.name}" on ${event.date}`,
        eventId: eventId,
        date: new Date().toISOString()
    });

    // Add to volunteer history
    addToHistory(volunteerId, {
        eventId: eventId,
        eventName: event.name,
        description: event.description,
        location: event.location,
        requiredSkills: event.requiredSkills,
        urgency: event.urgency,
        date: event.date,
        status: 'Assigned'
    });

    res.sendApiOkay({ message: 'Volunteer assigned successfully' });
});

// Get notifications for the current user
app.get('/api/notifications', requireLogin, (req, res) => {
    const userNotifications = notifications[req.userId] || [];
    res.sendApiOkay({ notifications: userNotifications });
});

// Get volunteer history (maybe admin only?)
app.get('/api/history', requireLogin, (req, res) => {
    const history = volunteerHistory[req.userId] || [];
    res.sendApiOkay({ history });
});
// Catch-all route to serve the index.html file for any unmatched routes
app.use((req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start the server
app.listen(config.server_port, () => {
    console.log(`Server is running at http://localhost:${config.server_port}`);
});