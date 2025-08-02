const express = require('express');
const app = express();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const config = require('./config.json');

const db = require('./db.js');

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'api',
    key: config.mailgun_api_key
});

const isEmailValid = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isZipValid = zipCode => /^\d{5}$/.test(zipCode);
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
        availabilityStart: profile.availabilityStart || '',
        availabilityEnd: profile.availabilityEnd || ''
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
const events = {};
const notifications = {};
const volunteerHistory = {};
const eventAssignments = {};

const sendNotification = (recipientId, header, description) => {
    const notificationId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO notifications (id, user_id, header, description, time, is_unread)
        VALUES (?, ?, ?, ?, ?, 1)
    `).run(notificationId, recipientId, header, description, Date.now());

    // Send email notification if user exists and email is verified
    const user = db.prepare('SELECT email, is_email_verified FROM users WHERE id = ?').get(recipientId);
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
    db.prepare('INSERT INTO email_verification_codes (code, email) VALUES (?, ?)').run(code, email);
    console.log(`Generated email verification code ${code} for ${email}`);
    await sendEmail(
        'Volunteer Platform',
        email,
        'Verify your email',
        `Hey new volunteer!\n\nTo keep your account safe, please verify your email address by entering the code below on the website:\n\n${code}\n\nIf you did not create an account, please ignore this email.\n\nThanks!`
    );
};

// Middleware to check for valid session token and error out if not valid or present
const requireLogin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.sendApiError(401, 'missing_token', 'Authorization token is required');
    }
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    if (!session) {
        return res.sendApiError(401, 'invalid_token', 'Authorization token is invalid or expired');
    }
    req.userId = session.user_id;
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!req.user) {
        return res.sendApiError(500, 'user_not_found', 'User not found for the given token');
    }
    const profileRow = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId);
    const skills = db.prepare('SELECT skill FROM user_skills WHERE user_id = ?').all(req.userId).map(row => row.skill);
    req.profile = { ...(profileRow || {}), skills };
    next();
};

// Middleware to require the user to be an admin
const requireAdmin = (req, res, next) => {
    if (!req.user.is_admin) {
        return res.sendApiError(403, 'unauthorized', 'Admin access required');
    }
    next();
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
app.post('/api/auth/register', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    if (!password || !email) {
        return res.sendApiError(400, 'missing_params', 'Email and password are required');
    }
    if (!isEmailValid(email)) {
        return res.sendApiError(400, 'invalid_email', 'Email address is not valid');
    }
    if (password.length < 8) {
        return res.sendApiError(400, 'weak_password', 'Password must be at least 8 characters long');
    }
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
        return res.sendApiError(400, 'email_in_use', 'An account with that email address already exists');
    }
    const userId = randomString(8, 'hex');
    const passwordHash = await hashPassword(password);

    const user = {
        id: userId,
        email,
        password_hash: passwordHash,
        is_email_verified: 0,
        is_admin: 0
    };

    db.prepare('INSERT INTO users (id, email, password_hash, is_email_verified, is_admin) VALUES (@id, @email, @password_hash, @is_email_verified, @is_admin)').run(user);

    res.sendApiOkay({ user });

    // Send verification email (do not block response)
    if (config.mailgun_api_key) {
        sendVerificationEmail(email).catch(err => {
            console.error(`Failed to send verification email to ${email}:`, err);
        });
    }

    // Send welcome notification (do not block response)
    sendNotification(userId,
        'Welcome to Volunteer Platform!',
        'Thanks for registering! Please log in, verify your email address, and complete your profile to get started. Looking forward to your contributions!'
    );
    console.log(`Created user ${userId} (${email})`);
});

// Log into account with username/email and password, returns a session token
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!password || !email) {
        return res.sendApiError(400, 'missing_params', 'Email and password are required');
    }
    if (!isEmailValid(email)) {
        return res.sendApiError(400, 'invalid_email', 'Email address is not valid');
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
        return res.sendApiError(401, 'invalid_credentials', 'Invalid email or password');
    }
    const valid = await checkPassword(password, user.password_hash);
    if (!valid) {
        return res.sendApiError(401, 'invalid_credentials', 'Invalid email or password');
    }
    if (!user.is_email_verified) {
        // Send verification code again
        if (config.mailgun_api_key) {
            sendVerificationEmail(user.email).catch(err => {
                console.error(`Failed to send verification email to ${user.email}:`, err);
            });
        }
        return res.status(403).json({
            success: false,
            code: 'email_not_verified',
            message: 'Email not verified. Please check your email for a verification code.',
            userId: user.id,
            email: user.email
        });
    }
    const token = randomString(64, 'base64');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.sendApiOkay({ token, userId: user.id, email: user.email });
});

// Endpoint to get current user info (for client-side checks)
app.get('/api/auth/me', requireLogin, (req, res) => {
    res.sendApiOkay({
        userId: req.userId,
        email: req.user.email,
        is_email_verified: req.user.is_email_verified,
        is_admin: req.user.is_admin
    });
});

// Log out and delete the current session token
app.post('/api/auth/logout', requireLogin, (req, res) => {
    const token = req.headers['authorization'];
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.sendApiOkay();
});

// Get current user profile info
app.get('/api/profile', requireLogin, (req, res) => {
    try {
        const row = db.prepare(`
            SELECT full_name, address_1, address_2, city, state, zip_code, preferences, availability_start, availability_end
            FROM user_profiles
            WHERE user_id = ?
        `).get(req.userId);
        const skills = db.prepare(`
            SELECT skill FROM user_skills WHERE user_id = ?
        `).all(req.userId).map(row => row.skill);

        const profile = {
            fullName: row?.full_name || '',
            address1: row?.address_1 || '',
            address2: row?.address_2 || '',
            city: row?.city || '',
            state: row?.state || '',
            zipCode: row?.zip_code || '',
            skills,
            preferences: row?.preferences || '',
            availabilityStart: row?.availability_start || '',
            availabilityEnd: row?.availability_end || ''
        };
        res.sendApiOkay(profile);
    } catch (err) {
        console.error(err);
        res.sendApiError(500, 'db_error', 'Failed to load user profile');
    }
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
    // Validate required fields
    if (!fullName || !address1 || !city || !state || !zipCode) {
        return res.sendApiError(400, 'missing_required', 'Missing required profile fields.');
    }
    //Make sure zip code is of 5 char length 
    if (zipCode && !isZipValid(zipCode)) {
        return res.sendApiError(400, 'invalid_zip', 'Zip code must be 5 digits');
    }
    // Validate all availability_dates
    if (availabilityStart && availabilityEnd) {
        if (!isDateValid(availabilityStart) || !isDateValid(availabilityEnd)) {
            return res.sendApiError(400, 'invalid_date', 'Start or end date is invalid');
        }
        if (new Date(availabilityEnd) < new Date(availabilityStart)) {
            return res.sendApiError(400, 'invalid_range', 'End date cannot be earlier than start date.');
        }
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO user_profiles (user_id, full_name, address_1, address_2, city, state, zip_code, preferences, availability_start, availability_end)
            VALUES (@user_id, @fullName, @address1, @address2, @city, @state, @zipCode, @preferences, @availabilityStart, @availabilityEnd)
            ON CONFLICT(user_id) DO UPDATE SET
                full_name=@fullName,
                address_1=@address1,
                address_2=@address2,
                city=@city,
                state=@state,
                zip_code=@zipCode,
                preferences=@preferences,
                availability_start=@availabilityStart,
                availability_end=@availabilityEnd
            `);
        const userExists = db.prepare(`SELECT 1 FROM users WHERE id = ?`).get(req.userId);
        if (!userExists) {
            return res.status(400).send('User does not exist!');
        }
        stmt.run({
            user_id: req.userId,
            fullName,
            address1,
            address2,
            city,
            state,
            zipCode,
            preferences,
            availabilityStart,
            availabilityEnd
        });

        // Replacing skills (done by deleting and inserting)
        db.prepare(`DELETE FROM user_skills WHERE user_id = ?`).run(req.userId);

        const insertSkill = db.prepare(`INSERT INTO user_skills (user_id, skill) VALUES (?, ?)`);
        if (Array.isArray(skills)) {
            for (const skill of skills) {
                insertSkill.run(req.userId, skill);
            }
        }
        res.sendApiOkay({ message: 'Profile updated successfully!' });
    } catch (err) {
        console.error(err);
        res.sendApiError(500, 'db_error', 'Failed to update profile');
    }
});

/*

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

*/

// Get events assigned to the current user (with skills)
app.post('/api/profile/events', requireLogin, (req, res) => {
    const userId = req.userId;

    // Get events for the logged-in volunteer
    const assignedEvents = db.prepare(`
        SELECT e.* 
        FROM events e
        JOIN event_assignments ea ON e.id = ea.event_id
        WHERE ea.user_id = ?
    `).all(userId);

    // Fetch skills for each event
    const skillStmt = db.prepare(`SELECT skill FROM event_skills WHERE event_id = ?`);
    assignedEvents.forEach(event => {
        const skills = skillStmt.all(event.id).map(row => row.skill);
        event.skills = skills;
    });

    console.log(`User ${userId} fetched ${assignedEvents.length} assigned event(s).`);
    res.sendApiOkay({ events: assignedEvents });
});

// Get all events (admin only)
app.get('/api/events', requireLogin, requireAdmin, (req, res) => {
    const events = db.prepare(`SELECT * FROM events WHERE deleted = 0`).all();

    // Attach skills to each event
    const getSkills = db.prepare(`SELECT skill FROM event_skills WHERE event_id = ?`);
    for (const event of events) {
        const skills = getSkills.all(event.id).map(s => s.skill);
        event.skills = skills;
    }

    console.log(`Admin ${req.userId} fetched all events (${events.length} total)`); ///////
    res.sendApiOkay({ events });
});

// Get a single event (admin only)
app.get('/api/events/event', requireLogin, requireAdmin, (req, res) => {
    const eventId = req.query.eventId;
    const event = db.prepare(`SELECT * FROM events WHERE id = ? AND deleted = 0`).get(eventId);

    if (!event) {
        console.log('Event not found with ID:', eventId); ///////
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    // Fetch skills for this event
    const skills = db.prepare(`SELECT skill FROM event_skills WHERE event_id = ?`).all(eventId).map(s => s.skill);
    event.skills = skills;

    console.log(`Admin ${req.userId} fetched event ${eventId} with skills:`, skills); ///////
    res.sendApiOkay({ event });
});

// Soft delete event (admin only)
app.post('/api/events/delete', requireLogin, requireAdmin, (req, res) => {
    const { id } = req.body;
    if (!id) return res.sendApiError(400, 'invalid_input', 'Event ID is required.');

    const result = db.prepare(`UPDATE events SET deleted = 1 WHERE id = ?`).run(id);

    if (result.changes === 0) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    console.log(`Event ${id} marked as deleted by admin ${req.userId}`);
    res.sendApiOkay({ message: 'Event deleted successfully' });
});

// Create new event (admin only)
app.post('/api/events/create', requireLogin, requireAdmin, (req, res) => {
    const { name, description, location, skills, urgency, date } = req.body;

    if (!name || !description || !location || !Array.isArray(skills) || !urgency || !date) {
        return res.sendApiError(400, 'invalid_input', 'All fields are required and must be valid.');
    }

    const eventId = randomString(8, 'hex'); // Consistent event ID

    const createEventTransaction = db.transaction(() => {
        // Insert into events
        db.prepare(`
            INSERT INTO events (id, name, description, location, urgency, date, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(eventId, name, description, location, urgency, date, req.userId);

        console.log(`Inserted event: ${eventId} - ${name}`);

        // Insert skills
        const insertSkill = db.prepare(`
            INSERT INTO event_skills (event_id, skill) VALUES (?, ?)
        `);

        for (const skill of skills) {
            if (skill && typeof skill === 'string') {
                insertSkill.run(eventId, skill);
                console.log(`Inserted skill for event ${eventId}: ${skill}`);
            }
        }
    });

    try {
        createEventTransaction();

        const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
        event.skills = skills;

        console.log(`Created event ${eventId}: ${name} with skills: [${skills.join(', ')}]`);
        res.sendApiOkay({ event });
    } catch (err) {
        console.error('Error creating event:', err);
        res.sendApiError(500, 'database_error', 'Failed to create event');
    }
});

// Update existing event info (admin only)
app.post('/api/events/update', requireLogin, requireAdmin, (req, res) => {
    const { id, name, description, location, skills, urgency, date } = req.body;

    if (!id || !name || !description || !location || !Array.isArray(skills) || !urgency || !date) {
        return res.sendApiError(400, 'invalid_input', 'All fields are required and must be valid.');
    }

    const updateEventTransaction = db.transaction(() => {
        // Update event
        const result = db.prepare(`
            UPDATE events
            SET name = ?, description = ?, location = ?, urgency = ?, date = ?
            WHERE id = ?
        `).run(name, description, location, urgency, date, id);

        if (result.changes === 0) {
            throw new Error('Event not found');
        }

        console.log(`Updated event ${id}: ${name} with skills: [${skills.join(', ')}]`);

        // Replace skills
        db.prepare(`DELETE FROM event_skills WHERE event_id = ?`).run(id);
        const insertSkill = db.prepare(`INSERT INTO event_skills (event_id, skill) VALUES (?, ?)`);
        for (const skill of skills) {
            if (skill && typeof skill === 'string') {
                insertSkill.run(id, skill);
                console.log(`Inserted skill for event ${id}: ${skill}`);
            }
        }
    });

    try {
        updateEventTransaction();

        // Fetch updated event + skills
        const updatedEvent = db.prepare(`SELECT * FROM events WHERE id = ?`).get(id);
        updatedEvent.skills = db.prepare(`SELECT skill FROM event_skills WHERE event_id = ?`).all(id).map(r => r.skill);

        // Notify assigned volunteers
        const assignedVolunteers = db.prepare(`
            SELECT user_id FROM event_assignments WHERE event_id = ?
        `).all(id);

        assignedVolunteers.forEach(({ user_id }) => {
            sendNotification(
                user_id,
                'Event Updated',
                `The event "${updatedEvent.name}" you're assigned to has been updated. Please check the event details.`
            );
        });

        res.sendApiOkay({ event: updatedEvent });
    } catch (err) {
        console.error('Error updating event:', err);
        if (err.message === 'Event not found') {
            return res.sendApiError(404, 'event_not_found', 'Event not found');
        }
        res.sendApiError(500, 'database_error', 'Failed to update event');
    }
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

    try {
        // Check event exists
        const event = db.prepare(`
            SELECT name, date FROM events WHERE id = ?
        `).get(eventId);

        if (!event) {
            return res.sendApiError(404, 'event_not_found', 'Event not found');
        }

        // Check volunteer exists
        const volunteer = db.prepare(`
            SELECT id FROM users WHERE id = ?
        `).get(volunteerId);

        if (!volunteer) {
            return res.sendApiError(404, 'volunteer_not_found', 'Volunteer not found');
        }

        // Check if already assigned
        const existing = db.prepare(`
            SELECT 1 FROM event_assignments WHERE event_id = ? AND user_id = ?
        `).get(eventId, volunteerId);

        if (existing) {
            return res.sendApiError(400, 'already_assigned', 'Volunteer is already assigned to this event');
        }

        // Start transaction
        db.prepare('BEGIN').run();

        // Create assignment
        db.prepare(`
            INSERT INTO event_assignments (event_id, user_id)
            VALUES (?, ?)
        `).run(eventId, volunteerId);

        // Add to volunteer history
        db.prepare(`
            INSERT INTO volunteer_history (user_id, event_id, status, assigned_at)
            VALUES (?, ?, ?, ?)
        `).run(volunteerId, eventId, 'Assigned', new Date().toISOString());

        // Send notification
        sendNotification(
            volunteerId,
            'Event Assignment',
            `You have been assigned to "${event.name}" on ${event.date}`
        );

        db.prepare('COMMIT').run();

        res.sendApiOkay({ message: 'Volunteer assigned successfully' });
    } catch (err) {
        db.prepare('ROLLBACK').run();
        console.error('Assign volunteer error:', err);
        res.sendApiError(500, 'db_error', 'Failed to assign volunteer');
    }
});

// Get notifications for the current user
// Get notifications for the current user
app.get('/api/notifications', requireLogin, (req, res) => {
    try {
        const notifications = db.prepare(`
            SELECT id, header, description, time, is_unread
            FROM notifications
            WHERE user_id = ?
            ORDER BY time DESC
        `).all(req.userId);

        res.sendApiOkay({
            notifications: notifications.map(n => ({
                id: n.id,
                header: n.header,
                description: n.description,
                time: n.time,
                read: !n.is_unread
            }))
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.sendApiError(500, 'db_error', 'Failed to fetch notifications');
    }
});

// Get volunteer history (maybe admin only?)
// Get volunteer history
app.get('/api/history', requireLogin, (req, res) => {
    try {
        const history = db.prepare(`
            SELECT 
                vh.event_id,
                vh.status,
                vh.assigned_at,
                e.name as event_name,
                e.description,
                e.location,
                e.urgency,
                e.date
            FROM volunteer_history vh
            LEFT JOIN events e ON vh.event_id = e.id
            WHERE vh.user_id = ?
            ORDER BY vh.assigned_at DESC
        `).all(req.userId);

        // Get skills for each event
        const getSkills = db.prepare(`
            SELECT skill FROM event_skills WHERE event_id = ?
        `);

        const historyWithDetails = history.map(entry => ({
            eventId: entry.event_id,
            event: entry.event_name ? {
                id: entry.event_id,
                name: entry.event_name,
                description: entry.description,
                location: entry.location,
                urgency: entry.urgency,
                date: entry.date,
                skills: getSkills.all(entry.event_id).map(row => row.skill)
            } : null,
            status: entry.status,
            assignedAt: entry.assigned_at
        }));

        res.sendApiOkay({ history: historyWithDetails });
    } catch (err) {
        console.error('Get history error:', err);
        res.sendApiError(500, 'db_error', 'Failed to fetch history');
    }
});

// Endpoint to verify email with code, userId, and email (no login required)
app.post('/api/auth/verify-email', (req, res) => {
    const { userId, email, code } = req.body;
    if (!userId || !email || !code) {
        return res.sendApiError(400, 'missing_params', 'User ID, email, and code are required');
    }
    let verificationEntry;
    try {
        verificationEntry = db.prepare('SELECT email FROM email_verification_codes WHERE code = ?').get(code);
    } catch (err) {
        return res.sendApiError(400, 'invalid_code', 'Verification code is invalid or expired');
    }
    if (!verificationEntry) {
        return res.sendApiError(400, 'invalid_code', 'Verification code is invalid or expired');
    }
    if (verificationEntry.email.toLowerCase() !== email.toLowerCase()) {
        return res.sendApiError(400, 'code_email_mismatch', 'Verification code does not match email');
    }
    let user;
    try {
        user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    } catch (err) {
        return res.sendApiError(404, 'user_not_found', 'User not found for this code and email');
    }
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
        return res.sendApiError(404, 'user_not_found', 'User not found for this code and email');
    }
    db.prepare('UPDATE users SET is_email_verified = 1 WHERE id = ?').run(userId);
    db.prepare('DELETE FROM email_verification_codes WHERE code = ?').run(code);
    res.sendApiOkay({ message: 'Email verified successfully!' });
});


// Catch-all route to serve the index.html file for any unmatched routes
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) {
        // API route not found
        return res.status(404).json({ success: false, code: 'not_found', message: 'API endpoint not found' });
    }
    res.sendFile(__dirname + '/public/index.html');
});

// Error handler middleware (must be last)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ success: false, code: 'internal_error', message: 'An unexpected error occurred.' });
});

// Start the server
const appRunning = app.listen(config.server_port, () => {
    console.log(`Server is running at http://localhost:${config.server_port}`);
});

module.exports = {
    app: appRunning,
    expressApp: app
};
