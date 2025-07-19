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

// Helper to normalize user account data (not profile)
function normalizeUser(user) {
    return {
        email: user.email || '',
        password_hash: user.password_hash || '',
        is_email_verified: !!user.is_email_verified,
        is_admin: !!user.is_admin
    };
}

// Helper to normalize user profile data
function normalizeProfile(profile) {
    return {
        fullName: profile.fullName || '',
        address1: profile.address1 || '',
        address2: profile.address2 || '',
        city: profile.city || '',
        state: profile.state || '',
        zipCode: profile.zipCode || '',
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        preferences: profile.preferences || '',
        availabilityStart: profile.availabilityStart ? new Date(profile.availabilityStart).toISOString().split('T')[0] : '',
        availabilityEnd: profile.availabilityEnd ? new Date(profile.availabilityEnd).toISOString().split('T')[0] : ''
    };
}

// Helper to normalize event data
function normalizeEvent(event) {
    return {
        id: event.id,
        name: event.name || '',
        description: event.description || '',
        location: event.location || '',
        skills: Array.isArray(event.skills) ? event.skills : [],
        urgency: event.urgency || '',
        date: event.date ? new Date(event.date).toISOString() : '',
        createdBy: event.createdBy || ''
    };
}

// Helper to normalize notification data
function normalizeNotification(notification) {
    return {
        id: notification.id,
        header: notification.header || '',
        description: notification.description || '',
        time: typeof notification.time === 'number' ? notification.time : Date.now(),
        read: !!notification.read
    };
}

// Helper to normalize volunteer history entry
function normalizeHistoryEntry(entry) {
    return {
        eventId: entry.eventId,
        status: entry.status || 'Assigned',
        assignedAt: entry.assignedAt ? new Date(entry.assignedAt).toISOString() : new Date().toISOString()
    };
}

// In-memory data maps to act as database for now
const users = {}; // userId -> user account (email, password_hash, is_email_verified, is_admin)
const userProfiles = {}; // userId -> user profile
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
    users[adminUserId] = normalizeUser({
        email: adminUserEmail,
        password_hash: await hashPassword(adminUserPassword),
        is_email_verified: true,
        is_admin: true
    });
    userProfiles[adminUserId] = normalizeProfile({
        name: 'Admin User'
    });
    console.log(`Created temp admin user with ID: ${adminUserId}, Email: ${adminUserEmail}, Password: ${adminUserPassword}`);
})();

const sendNotification = (recipientId, header, description, time = Date.now()) => {
    if (!notifications[recipientId]) {
        notifications[recipientId] = [];
    }

    const notification = {
        id: crypto.randomUUID(),
        header,
        description,
        time,
        read: false
    };

    notifications[recipientId].push(notification);

    // Send email notification if user exists and email is verified
    const user = users[recipientId];
    if (user && user.is_email_verified) {
        sendEmail(
            'Volunteer Platform',
            user.email,
            header,
            description
        ).catch(err => {
            console.error(`Failed to send email to ${user.email}:`, err);
        });
    }
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

const addVolunteerHistory = (userId, eventId) => {
    if (!volunteerHistory[userId]) {
        volunteerHistory[userId] = [];
    }

    const event = events[eventId];
    if (!event) return;

    volunteerHistory[userId].push({
        eventId: eventId,
        eventName: event.name,
        description: event.description,
        location: event.location,
        requiredSkills: event.skills,
        urgency: event.urgency,
        date: event.date,
        status: 'Assigned',
        assignedAt: new Date().toISOString()
    });
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
    users[userId] = normalizeUser({
        email,
        password_hash: passwordHash
    });
    userProfiles[userId] = normalizeProfile({});
    // Send welcome notification
    sendNotification(userId,
        'Welcome to Volunteer Platform!',
        'Thank you for registering. Please complete your profile to get started with volunteering opportunities.'
    );

    // Send verification email
    if (config.mailgun_api_key) {
        sendVerificationEmail(email).catch(err => {
            console.error(`Failed to send verification email to ${email}:`, err);
        });
    }
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
    req.profile = userProfiles[userId];
    if (!req.user) {
        return res.sendApiError(500, 'user_not_found', 'User not found for the given token');
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.user.is_admin) {
        return res.sendApiError(403, 'unauthorized', 'Admin access required');
    }
    next();
};

// Log out and delete the current session token
app.post('/api/auth/logout', requireLogin, (req, res) => { });

// Get current user profile info
app.get('/api/profile', requireLogin, (req, res) => {
    const profile = normalizeProfile(req.profile);
    res.sendApiOkay({ profile });
});

// Update current user profile info
app.post('/api/profile/update', requireLogin, (req, res) => {
    const {
        fullName,
        address1,
        address2,
        city,
        state,
        zipCode,
        skills,
        preferences,
        availabilityStart,
        availabilityEnd
    } = req.body;
    //Make sure zip code is of 5 char length 
    if (zip && !isZipValid(zip)) {
        return res.sendApiError(400, 'invalid_zip', 'Zip code must be 5 digits');
    }
    // Validate all availability_dates
    if (availabilityStart && availabilityEnd) {
        if (!isDateValid(availabilityStart) || !isDateValid(availabilityEnd)) {
            return res.sendApiError(400, 'invalid_date', 'Start or end date is invalid');
        }
        if (new Date(availabilityEnd) < new Date(availabilityStart)) {
            return res.sendApiError(400, 'invalid_range','End date cannot be earlier than start date.');
        }
    }
    //Update the User Profile
    userProfiles[req.userId] = normalizeProfile({
        fullName,
        address1,
        address2,
        city,
        state,
        zipCode,
        skills,
        preferences,
        availabilityStart,
        availabilityEnd
    });
    res.sendApiOkay({ message: 'Profile updated successfully!' });
});

// Get events assigned to the current user
app.post('/api/profile/events', requireLogin, (req, res) => {
    const userId = req.userId;
    const assigned = [];

    for (const [eventId, volunteerIds] of Object.entries(eventAssignments)) {
        if (volunteerIds.includes(userId)) {
            assigned.push(events[eventId]);
        }
    }

    // Log the request
    console.log(`User ${userId} fetched ${assigned.length} assigned event(s)`);

    res.sendApiOkay({ events: assigned });
});

// Get all events (admin only)
app.get('/api/events', requireLogin, (req, res) => {
    if (!req.user.is_admin) {
        return res.sendApiError(403, 'unauthorized', 'Admin access required');
    }

    const allEvents = Object.values(events);

    // Log the request
    console.log(`Admin ${req.userId} fetched all events (${allEvents.length} total)`);

    res.sendApiOkay({ events: allEvents });
});

// Get a single event
app.get('/api/events/event', requireLogin, (req, res) => {
    const eventId = req.query.eventId;
    const event = events[eventId];

    if (!event) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    res.sendApiOkay({ event });
});

// Create new event (admin only)
app.post('/api/events/create', requireLogin, requireAdmin, (req, res) => {
    const { name, description, location, skills, urgency, date } = req.body;
    if (!name || !description || !location || !Array.isArray(skills) || !urgency || !date) {
        return res.sendApiError(400, 'invalid_input', 'All fields are required and must be valid.');
    }

    const eventId = randomString(8, 'hex'); // shorter, readable ID

    // Add eventId into the object before normalization
    const rawEvent = {
        id: eventId,
        name,
        description,
        location,
        skills,
        urgency,
        date,
        createdBy: req.userId
    };

    events[eventId] = normalizeEvent(rawEvent); // This now includes ID correctly

    console.log(`Created event ${eventId}: ${name}`);
    res.sendApiOkay({ event: events[eventId] });
});

// Update existing event info (admin only)
app.post('/api/events/update', requireLogin, requireAdmin, (req, res) => {
    const eventId = (req.body.id || '').trim(); // Normalize
    const { name, description, location, skills, urgency, date } = req.body;

    console.log('Incoming update request with eventId:', eventId); //////////
    console.log('Available event keys:', Object.keys(events)); ////////////


    const event = events[eventId];
    if (!event) {
        console.log('Event not found with ID:', eventId); ////////////
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    Object.assign(event, normalizeEvent({
        id: eventId,
        name,
        description,
        location,
        skills,
        urgency,
        date,
        createdBy: event.createdBy
    }));

    console.log(`Updated event ${eventId}: ${name}`);

    // Notify assigned volunteers about the update
    if (eventAssignments[eventId]) {
        eventAssignments[eventId].forEach(volunteerId => {
            sendNotification(volunteerId,
                'Event Updated',
                `The event "${event.name}" you're assigned to has been updated. Please check the event details.`
            );
        });
    }
    res.sendApiOkay({ event });
});

// Get volunteers that are available for a certain event (admin only)
app.get('/api/events/match/check', requireLogin, requireAdmin, (req, res) => {
    const eventId = req.query.eventId;
    const event = events[eventId];

    if (!event) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    const matchingVolunteers = [];

    for (const userId in users) {
        const user = users[userId];
        const profile = userProfiles[userId];

        if (eventAssignments[eventId] && eventAssignments[eventId].includes(userId)) {
            continue;
        }

        const hasRequiredSkills = event.skills.some(skill =>
            (profile.skills || []).includes(skill)
        );

        const isAvailable = (profile.availability_dates || []).includes(event.date);

        const locationMatch = profile.city && profile.state &&
            event.location.includes(profile.city) &&
            event.location.includes(profile.state);

        if (hasRequiredSkills && isAvailable && locationMatch) {
            matchingVolunteers.push({
                userId: userId,
                name: profile.fullName || user.email, //this line was previously: 'name: profile.name || user.email,'
                email: user.email,
                skills: profile.skills,
                location: `${profile.city}, ${profile.state}`
            });
        }
    }

    res.sendApiOkay({ volunteers: matchingVolunteers });
});

// Assign a volunteer to an event (admin only)
app.post('/api/events/match/assign', requireLogin, requireAdmin, (req, res) => {
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
    sendNotification(volunteerId,
        'Event Assignment',
        `You have been assigned to "${event.name}" on ${event.date}`
    );

    // Add to volunteer history (store only eventId, status, assignedAt)
    if (!volunteerHistory[volunteerId]) volunteerHistory[volunteerId] = [];
    volunteerHistory[volunteerId].push(normalizeHistoryEntry({
        eventId: eventId,
        status: 'Assigned',
        assignedAt: new Date().toISOString()
    }));
    res.sendApiOkay({ message: 'Volunteer assigned successfully' });
});

// Get notifications for the current user
app.get('/api/notifications', requireLogin, (req, res) => {
    const userNotifications = (notifications[req.userId] || []).map(normalizeNotification);
    res.sendApiOkay({ notifications: userNotifications });
});

// Get volunteer history (maybe admin only?)
app.get('/api/history', requireLogin, (req, res) => {
    // Return event info by reference, not duplication
    const history = (volunteerHistory[req.userId] || []).map(entry => {
        const event = events[entry.eventId] || {};
        return {
            eventId: entry.eventId,
            event: event.id ? normalizeEvent(event) : null,
            status: entry.status,
            assignedAt: entry.assignedAt
        };
    });
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
