const express = require('express');
const app = express();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const config = require('./config.json');
const PDFDocument = require('pdfkit');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

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
    // Always return success: true, but include is_email_verified property
    if (!user.is_email_verified) {
        // Send verification code again
        if (config.mailgun_api_key) {
            sendVerificationEmail(user.email).catch(err => {
                console.error(`Failed to send verification email to ${user.email}:`, err);
            });
        }
    }
    const token = randomString(64, 'base64');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    return res.json({
        success: true,
        token,
        user: {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin,
            is_email_verified: user.is_email_verified
        },
        is_email_verified: user.is_email_verified
    });
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

    // Get event details
    const event = db.prepare(`
        SELECT id, name, description, location, urgency, date
        FROM events
        WHERE id = ? AND deleted = 0
    `).get(eventId);

    if (!event) {
        return res.sendApiError(404, 'event_not_found', 'Event not found');
    }

    // Get required skills for the event
    const requiredSkills = db.prepare(`
        SELECT skill FROM event_skills WHERE event_id = ?
    `).all(eventId).map(row => row.skill);

    // Get already assigned volunteers
    const assignedVolunteers = db.prepare(`
        SELECT user_id FROM event_assignments WHERE event_id = ?
    `).all(eventId).map(row => row.user_id);

    // Get all volunteers excluding assigned ones
    const volunteers = db.prepare(`
        SELECT u.id, u.email, up.full_name, up.city, up.state, up.availability_start, up.availability_end
        FROM users u
        JOIN user_profiles up ON u.id = up.user_id
        WHERE u.is_admin = 0
    `).all();

    const getUserSkills = db.prepare(`SELECT skill FROM user_skills WHERE user_id = ?`);

    const matchingVolunteers = volunteers
        .filter(vol => !assignedVolunteers.includes(vol.id)) // Exclude assigned
        .map(vol => {
            const volSkills = getUserSkills.all(vol.id).map(row => row.skill);
            const hasRequiredSkills = requiredSkills.every(skill => volSkills.includes(skill));

            // Check availability
            const isAvailable =
                (!vol.availability_start || !vol.availability_end) ||
                (new Date(event.date) >= new Date(vol.availability_start) &&
                    new Date(event.date) <= new Date(vol.availability_end));

            // Check location match (basic: city & state must match)
            const locationMatch = vol.city && vol.state &&
                event.location.includes(vol.city) &&
                event.location.includes(vol.state);

            return hasRequiredSkills && isAvailable && locationMatch
                ? {
                    userId: vol.id,
                    name: vol.full_name || vol.email,
                    email: vol.email,
                    skills: volSkills,
                    location: `${vol.city || ''}, ${vol.state || ''}`
                }
                : null;
        })
        .filter(Boolean);

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

// Generate Volunteer Report
app.get('/api/reports/volunteers', requireLogin, requireAdmin, async (req, res) => {
    const format = req.query.format || 'json';

    try {
        // Fetch all volunteers with their profiles and skills
        const volunteers = db.prepare(`
            SELECT 
                u.id,
                u.email,
                u.is_email_verified,
                up.full_name,
                up.address_1,
                up.address_2,
                up.city,
                up.state,
                up.zip_code,
                up.preferences,
                up.availability_start,
                up.availability_end
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.is_admin = 0
            ORDER BY up.full_name, u.email
        `).all();

        // Fetch skills and history for each volunteer
        const getSkills = db.prepare(`SELECT skill FROM user_skills WHERE user_id = ?`);
        const getHistory = db.prepare(`
            SELECT 
                e.name as event_name,
                e.date as event_date,
                e.location as event_location,
                vh.status,
                vh.assigned_at
            FROM volunteer_history vh
            JOIN events e ON vh.event_id = e.id
            WHERE vh.user_id = ?
            ORDER BY e.date DESC
        `);

        const volunteerData = volunteers.map(vol => {
            const skills = getSkills.all(vol.id).map(s => s.skill);
            const history = getHistory.all(vol.id);

            return {
                id: vol.id,
                email: vol.email,
                emailVerified: vol.is_email_verified ? 'Yes' : 'No',
                fullName: vol.full_name || 'Not provided',
                address: `${vol.address_1 || ''} ${vol.address_2 || ''}`.trim() || 'Not provided',
                city: vol.city || 'Not provided',
                state: vol.state || 'Not provided',
                zipCode: vol.zip_code || 'Not provided',
                skills: skills.join(', ') || 'None',
                preferences: vol.preferences || 'None',
                availabilityStart: vol.availability_start || 'Not set',
                availabilityEnd: vol.availability_end || 'Not set',
                totalEvents: history.length,
                completedEvents: history.filter(h => h.status === 'Completed').length,
                upcomingEvents: history.filter(h => new Date(h.event_date) > new Date()).length,
                history: history
            };
        });

        // Generate report based on format
        if (format === 'json') {
            res.json({
                success: true,
                report_type: 'volunteers',
                generated_at: new Date().toISOString(),
                total_volunteers: volunteerData.length,
                verified_volunteers: volunteerData.filter(v => v.emailVerified === 'Yes').length,
                volunteers: volunteerData
            });
        } else if (format === 'csv') {
            // Create temporary CSV file
            const tempFile = path.join(__dirname, `volunteer_report_${Date.now()}.csv`);

            // Flatten data for CSV
            const csvData = [];
            volunteerData.forEach(vol => {
                if (vol.history.length === 0) {
                    csvData.push({
                        email: vol.email,
                        fullName: vol.fullName,
                        city: vol.city,
                        state: vol.state,
                        zipCode: vol.zipCode,
                        skills: vol.skills,
                        totalEvents: vol.totalEvents,
                        eventName: 'No events',
                        eventDate: '',
                        eventStatus: ''
                    });
                } else {
                    vol.history.forEach(event => {
                        csvData.push({
                            email: vol.email,
                            fullName: vol.fullName,
                            city: vol.city,
                            state: vol.state,
                            zipCode: vol.zipCode,
                            skills: vol.skills,
                            totalEvents: vol.totalEvents,
                            eventName: event.event_name,
                            eventDate: event.event_date,
                            eventStatus: event.status
                        });
                    });
                }
            });

            const csvWriter = createObjectCsvWriter({
                path: tempFile,
                header: [
                    { id: 'email', title: 'Email' },
                    { id: 'fullName', title: 'Full Name' },
                    { id: 'city', title: 'City' },
                    { id: 'state', title: 'State' },
                    { id: 'zipCode', title: 'Zip Code' },
                    { id: 'skills', title: 'Skills' },
                    { id: 'totalEvents', title: 'Total Events' },
                    { id: 'eventName', title: 'Event Name' },
                    { id: 'eventDate', title: 'Event Date' },
                    { id: 'eventStatus', title: 'Status' }
                ]
            });

            await csvWriter.writeRecords(csvData);

            res.download(tempFile, 'volunteer_report.csv', (err) => {
                // Clean up temp file
                fs.unlinkSync(tempFile);
                if (err) {
                    console.error('CSV download error:', err);
                    res.sendApiError(500, 'download_error', 'Failed to download CSV');
                }
            });
        } else if (format === 'pdf') {
            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.pdf');
                res.send(pdfBuffer);
            });

            // PDF Header
            doc.fontSize(20).text('Volunteer Report', { align: 'center' });
            doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown();

            // Summary Statistics
            doc.fontSize(14).text('Summary Statistics', { underline: true });
            doc.fontSize(10);
            doc.text(`Total Volunteers: ${volunteerData.length}`);
            doc.text(`Verified Accounts: ${volunteerData.filter(v => v.emailVerified === 'Yes').length}`);
            doc.text(`Active Volunteers: ${volunteerData.filter(v => v.totalEvents > 0).length}`);
            doc.moveDown();

            // Volunteer Details
            doc.fontSize(14).text('Volunteer Details', { underline: true });
            doc.fontSize(10);
            doc.moveDown();

            volunteerData.forEach((vol, index) => {
                // Check if we need a new page
                if (doc.y > 650) {
                    doc.addPage();
                }

                doc.fontSize(12).text(`${index + 1}. ${vol.fullName}`, { underline: true });
                doc.fontSize(10);
                doc.text(`   Email: ${vol.email} (${vol.emailVerified === 'Yes' ? 'Verified' : 'Unverified'})`);
                doc.text(`   Location: ${vol.city}, ${vol.state} ${vol.zipCode}`);
                doc.text(`   Skills: ${vol.skills}`);
                doc.text(`   Availability: ${vol.availabilityStart} to ${vol.availabilityEnd}`);
                doc.text(`   Total Events: ${vol.totalEvents} (${vol.completedEvents} completed, ${vol.upcomingEvents} upcoming)`);

                if (vol.history.length > 0) {
                    doc.text('   Recent Events:');
                    vol.history.slice(0, 3).forEach(event => {
                        doc.text(`      - ${event.event_name} (${event.event_date}) - ${event.status}`);
                    });
                }
                doc.moveDown();
            });

            doc.end();
        } else {
            res.sendApiError(400, 'invalid_format', 'Invalid format. Use json, csv, or pdf');
        }
    } catch (err) {
        console.error('Volunteer report generation error:', err);
        res.sendApiError(500, 'report_error', 'Failed to generate volunteer report');
    }
});

// Generate Event Report
app.get('/api/reports/events', requireLogin, requireAdmin, async (req, res) => {
    const format = req.query.format || 'json';

    try {
        // Fetch all events
        const events = db.prepare(`
            SELECT 
                e.id,
                e.name,
                e.description,
                e.location,
                e.urgency,
                e.date,
                e.created_by,
                u.email as creator_email
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.deleted = 0
            ORDER BY e.date DESC
        `).all();

        // Fetch skills and assignments for each event
        const getSkills = db.prepare(`SELECT skill FROM event_skills WHERE event_id = ?`);
        const getAssignments = db.prepare(`
            SELECT 
                u.email,
                up.full_name,
                up.city,
                up.state
            FROM event_assignments ea
            JOIN users u ON ea.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE ea.event_id = ?
        `);

        const eventData = events.map(event => {
            const skills = getSkills.all(event.id).map(s => s.skill);
            const assignments = getAssignments.all(event.id);
            const eventDate = new Date(event.date);
            const now = new Date();

            return {
                id: event.id,
                name: event.name,
                description: event.description,
                location: event.location,
                urgency: event.urgency,
                date: event.date,
                formattedDate: eventDate.toLocaleDateString(),
                status: eventDate > now ? 'Upcoming' : 'Past',
                createdBy: event.creator_email || 'Unknown',
                requiredSkills: skills.join(', ') || 'None',
                volunteersAssigned: assignments.length,
                volunteers: assignments.map(a => ({
                    email: a.email,
                    name: a.full_name || 'Not provided',
                    location: `${a.city || 'Unknown'}, ${a.state || 'Unknown'}`
                }))
            };
        });

        // Calculate statistics
        const stats = {
            totalEvents: eventData.length,
            upcomingEvents: eventData.filter(e => e.status === 'Upcoming').length,
            pastEvents: eventData.filter(e => e.status === 'Past').length,
            highUrgency: eventData.filter(e => e.urgency === 'high').length,
            mediumUrgency: eventData.filter(e => e.urgency === 'medium').length,
            lowUrgency: eventData.filter(e => e.urgency === 'low').length,
            totalAssignments: eventData.reduce((sum, e) => sum + e.volunteersAssigned, 0),
            averageVolunteersPerEvent: (eventData.reduce((sum, e) => sum + e.volunteersAssigned, 0) / eventData.length).toFixed(2)
        };

        // Generate report based on format
        if (format === 'json') {
            res.json({
                success: true,
                report_type: 'events',
                generated_at: new Date().toISOString(),
                statistics: stats,
                events: eventData
            });
        } else if (format === 'csv') {
            // Create temporary CSV file
            const tempFile = path.join(__dirname, `event_report_${Date.now()}.csv`);

            // Flatten data for CSV
            const csvData = [];
            eventData.forEach(event => {
                if (event.volunteers.length === 0) {
                    csvData.push({
                        eventName: event.name,
                        eventDate: event.formattedDate,
                        location: event.location,
                        urgency: event.urgency,
                        status: event.status,
                        requiredSkills: event.requiredSkills,
                        volunteersAssigned: 0,
                        volunteerName: 'No volunteers',
                        volunteerEmail: '',
                        volunteerLocation: ''
                    });
                } else {
                    event.volunteers.forEach(vol => {
                        csvData.push({
                            eventName: event.name,
                            eventDate: event.formattedDate,
                            location: event.location,
                            urgency: event.urgency,
                            status: event.status,
                            requiredSkills: event.requiredSkills,
                            volunteersAssigned: event.volunteersAssigned,
                            volunteerName: vol.name,
                            volunteerEmail: vol.email,
                            volunteerLocation: vol.location
                        });
                    });
                }
            });

            const csvWriter = createObjectCsvWriter({
                path: tempFile,
                header: [
                    { id: 'eventName', title: 'Event Name' },
                    { id: 'eventDate', title: 'Date' },
                    { id: 'location', title: 'Location' },
                    { id: 'urgency', title: 'Urgency' },
                    { id: 'status', title: 'Status' },
                    { id: 'requiredSkills', title: 'Required Skills' },
                    { id: 'volunteersAssigned', title: 'Total Volunteers' },
                    { id: 'volunteerName', title: 'Volunteer Name' },
                    { id: 'volunteerEmail', title: 'Volunteer Email' },
                    { id: 'volunteerLocation', title: 'Volunteer Location' }
                ]
            });

            await csvWriter.writeRecords(csvData);

            res.download(tempFile, 'event_report.csv', (err) => {
                // Clean up temp file
                fs.unlinkSync(tempFile);
                if (err) {
                    console.error('CSV download error:', err);
                    res.sendApiError(500, 'download_error', 'Failed to download CSV');
                }
            });
        } else if (format === 'pdf') {
            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=event_report.pdf');
                res.send(pdfBuffer);
            });

            // PDF Header
            doc.fontSize(20).text('Event Report', { align: 'center' });
            doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown();

            // Summary Statistics
            doc.fontSize(14).text('Summary Statistics', { underline: true });
            doc.fontSize(10);
            doc.text(`Total Events: ${stats.totalEvents}`);
            doc.text(`Upcoming Events: ${stats.upcomingEvents}`);
            doc.text(`Past Events: ${stats.pastEvents}`);
            doc.text(`High Urgency: ${stats.highUrgency}`);
            doc.text(`Medium Urgency: ${stats.mediumUrgency}`);
            doc.text(`Low Urgency: ${stats.lowUrgency}`);
            doc.text(`Total Volunteer Assignments: ${stats.totalAssignments}`);
            doc.text(`Average Volunteers per Event: ${stats.averageVolunteersPerEvent}`);
            doc.moveDown();

            // Event Details
            doc.fontSize(14).text('Event Details', { underline: true });
            doc.moveDown();

            // Group events by status
            const upcomingEvents = eventData.filter(e => e.status === 'Upcoming');
            const pastEvents = eventData.filter(e => e.status === 'Past');

            // Upcoming Events
            if (upcomingEvents.length > 0) {
                doc.fontSize(12).text('Upcoming Events:', { underline: true });
                doc.fontSize(10);
                upcomingEvents.forEach((event, index) => {
                    if (doc.y > 650) {
                        doc.addPage();
                    }
                    doc.text(`${index + 1}. ${event.name} - ${event.formattedDate}`);
                    doc.text(`   Location: ${event.location}`);
                    doc.text(`   Urgency: ${event.urgency.toUpperCase()}`);
                    doc.text(`   Required Skills: ${event.requiredSkills}`);
                    doc.text(`   Volunteers Assigned: ${event.volunteersAssigned}`);
                    if (event.volunteers.length > 0) {
                        doc.text('   Assigned Volunteers:');
                        event.volunteers.slice(0, 5).forEach(vol => {
                            doc.text(`      • ${vol.name} (${vol.email})`);
                        });
                        if (event.volunteers.length > 5) {
                            doc.text(`      ... and ${event.volunteers.length - 5} more`);
                        }
                    }
                    doc.moveDown(0.5);
                });
                doc.moveDown();
            }

            // Past Events
            if (pastEvents.length > 0) {
                doc.fontSize(12).text('Past Events:', { underline: true });
                doc.fontSize(10);
                pastEvents.forEach((event, index) => {
                    if (doc.y > 650) {
                        doc.addPage();
                    }
                    doc.text(`${index + 1}. ${event.name} - ${event.formattedDate}`);
                    doc.text(`   Location: ${event.location}`);
                    doc.text(`   Volunteers Participated: ${event.volunteersAssigned}`);
                    doc.moveDown(0.5);
                });
            }

            doc.end();
        } else {
            res.sendApiError(400, 'invalid_format', 'Invalid format. Use json, csv, or pdf');
        }
    } catch (err) {
        console.error('Event report generation error:', err);
        res.sendApiError(500, 'report_error', 'Failed to generate event report');
    }
});

// Optional: Add a summary dashboard endpoint
app.get('/api/reports/dashboard', requireLogin, requireAdmin, async (req, res) => {
    try {
        const totalVolunteers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count;
        const verifiedVolunteers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0 AND is_email_verified = 1').get().count;
        const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events WHERE deleted = 0').get().count;
        const upcomingEvents = db.prepare('SELECT COUNT(*) as count FROM events WHERE deleted = 0 AND date > datetime("now")').get().count;
        const totalAssignments = db.prepare('SELECT COUNT(*) as count FROM event_assignments').get().count;

        // Most active volunteers
        const topVolunteers = db.prepare(`
            SELECT 
                u.email,
                up.full_name,
                COUNT(vh.event_id) as event_count
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN volunteer_history vh ON u.id = vh.user_id
            WHERE u.is_admin = 0
            GROUP BY u.id
            ORDER BY event_count DESC
            LIMIT 5
        `).all();

        // Most popular skills
        const popularSkills = db.prepare(`
            SELECT 
                skill,
                COUNT(*) as count
            FROM user_skills
            GROUP BY skill
            ORDER BY count DESC
            LIMIT 5
        `).all();

        res.json({
            success: true,
            dashboard: {
                volunteers: {
                    total: totalVolunteers,
                    verified: verifiedVolunteers,
                    unverified: totalVolunteers - verifiedVolunteers
                },
                events: {
                    total: totalEvents,
                    upcoming: upcomingEvents,
                    past: totalEvents - upcomingEvents
                },
                assignments: {
                    total: totalAssignments
                },
                topVolunteers: topVolunteers.map(v => ({
                    name: v.full_name || v.email,
                    eventCount: v.event_count
                })),
                popularSkills: popularSkills
            }
        });
    } catch (err) {
        console.error('Dashboard generation error:', err);
        res.sendApiError(500, 'dashboard_error', 'Failed to generate dashboard');
    }
});

// Get all skills
app.get('/api/skills', (req, res) => {
    try {
        const skills = db.prepare('SELECT id, label FROM skills ORDER BY label ASC').all();
        res.sendApiOkay({ skills });
    } catch (err) {
        console.error('Error loading skills:', err);
        res.sendApiError(500, 'db_error', 'Failed to load skills');
    }
});

// Add a new skill
app.post('/api/skills/add', (req, res) => {
    const { label } = req.body;
    if (!label || typeof label !== 'string') {
        return res.sendApiError(400, 'invalid_input', 'Skill label is required');
    }

    const trimmed = label.trim();
    if (!trimmed) return res.sendApiError(400, 'invalid_label', 'Label cannot be empty');

    try {
        const id = crypto.randomUUID();
        db.prepare(`INSERT INTO skills (id, label) VALUES (?, ?)`).run(id, trimmed);
        res.sendApiOkay({ message: 'Skill added', id, label: trimmed });
    } catch (err) {
        console.error('Error adding skill:', err);
        if (err.message.includes('UNIQUE')) {
            res.sendApiError(400, 'duplicate_skill', 'Skill already exists');
        } else {
            res.sendApiError(500, 'db_error', 'Failed to add skill');
        }
    }
});

// Remove skill
app.post('/api/skills/delete', (req, res) => {
    const { label } = req.body;
    if (!label) return res.sendApiError(400, 'missing_label', 'Skill label is required');

    try {
        db.prepare(`DELETE FROM skills WHERE label = ?`).run(label);
        res.sendApiOkay({ message: 'Skill removed' });
    } catch (err) {
        console.error('Error deleting skill:', err);
        res.sendApiError(500, 'db_error', 'Failed to delete skill');
    }
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
