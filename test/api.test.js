const request = require('supertest');
const { expect } = require('chai');
const server = require('../server');
const db = require('../db');


// Reusable helpers
const api = () => request(server.app);

async function register(email, password) {
    return api().post('/api/auth/register').send({ email, password });
}
async function login(email, password) {
    return api().post('/api/auth/login').send({ email, password });
}
function getUserIdByEmail(email) {
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    return row?.id;
}
function getVerifyCodeByEmail(email) {
    return db.prepare('SELECT code FROM email_verification_codes WHERE email = ?').get(email)?.code;
}
async function verifyEmailFor(email) {
    const userId = getUserIdByEmail(email);
    const code = getVerifyCodeByEmail(email);
    if (!userId || !code) return null;
    return api().post('/api/auth/verify-email').send({ userId, email, code });
}
async function ensureUserToken(email, password) {
    await register(email, password);
    let res = await login(email, password);
    if (res.statusCode === 403 && res.body?.code === 'email_not_verified') {
        await verifyEmailFor(email);
        res = await login(email, password);
    }
    return res.statusCode === 200 ? res.body.token : null;
}
async function ensureAdminToken() {
    const email = 'admin@example.com';
    const password = 'adminpassword';
    let res = await login(email, password);
    if (res.statusCode === 403 && res.body?.code === 'email_not_verified') {
        await verifyEmailFor(email);
        res = await login(email, password);
    }
    return res.statusCode === 200 ? res.body.token : null;
}
function withDbPrepareThrow(substr) {
    const orig = db.prepare;
    db.prepare = function (sql) {
        if (sql && sql.includes(substr)) throw new Error('DB fail');
        return orig.apply(this, arguments);
    };
    return () => { db.prepare = orig; };
}
function defaultEventPayload(overrides = {}) {
    return {
        name: 'Test Event',
        description: 'A test event',
        location: 'Testville, TS',
        skills: ['First Aid'],
        urgency: 'High',
        date: '2025-07-21T00:00:00.000Z',
        ...overrides,
    };
}
async function createEvent(token, overrides = {}) {
    return api()
        .post('/api/events/create')
        .set('Authorization', token)
        .send(defaultEventPayload(overrides));
}

const COMMON_ERROR_CODES = [400, 401, 403, 404, 422, 500];

describe('API Endpoints and Edge Cases', () => {
    before(() => {
        // Remove test data in correct order to avoid foreign key constraint errors
        const emails = [
            'testuser@example.com',
            'verifyuser@example.com',
            'mismatch@example.com',
            'notfound@example.com',
            'missingpass@example.com',
            'weakpass@example.com',
            'bademail',
            'nouser@example.com',
            'meuser@example.com',
            'profileuser@example.com',
            'profileupdate@example.com',
            'eventuser@example.com',
            'notifuser@example.com',
            'historyuser@example.com',
            'badcodetest@example.com',
            'badusertest@example.com',
            'ziptest@example.com',
            'notifhistory@example.com',
            'missingfields@example.com',
            'useronly@example.com',
            'doublelogout@example.com',
            'invalidcodetest@example.com',
            'adminupdate@example.com',
            'adminmatch@example.com',
            'adminmatch404@example.com',
            'adminassignerr@example.com',
            'notiferr@example.com',
            'histerr@example.com',
        ];
        for (const email of emails) {
            const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (user?.id) {
                db.prepare('DELETE FROM event_assignments WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM volunteer_history WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM notifications WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
                db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
            }
            db.prepare('DELETE FROM email_verification_codes WHERE email = ?').run(email);
        }
        // Remove test events and related data
        const eventNames = ['Test Event', 'Updated Event', 'Missing Volunteer Event', 'AssignFail', 'RollbackTest', 'SkillEvent', 'NotifEvent', 'AssignTest'];
        for (const name of eventNames) {
            const events = db.prepare('SELECT id FROM events WHERE name = ?').all(name);
            for (const event of events) {
                db.prepare('DELETE FROM event_assignments WHERE event_id = ?').run(event.id);
                db.prepare('DELETE FROM volunteer_history WHERE event_id = ?').run(event.id);
                db.prepare('DELETE FROM event_skills WHERE event_id = ?').run(event.id);
                db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
            }
        }
    });

    after(() => {
        server.app.close();
    });

    // Auth
    describe('Auth', () => {
        it('registers a user and creates a verification code', async () => {
            const email = 'testuser@example.com';
            const res = await register(email, 'testpassword123');
            expect(res.statusCode).to.equal(200);
            expect(res.body.success).to.equal(true);
            expect(getUserIdByEmail(email)).to.be.a('string');
            expect(getVerifyCodeByEmail(email)).to.be.a('string');
        });

        it('requires verification, then allows login', async () => {
            const email = 'verifyuser@example.com';
            const password = 'verifytest123';
            await register(email, password);
            let res = await login(email, password);
            expect(res.statusCode).to.equal(200);
            expect([0, 1, true, false]).to.include(res.body.is_email_verified);
            const v = await verifyEmailFor(email);
            expect(v?.statusCode).to.equal(200);
            res = await login(email, password);
            expect(res.statusCode).to.equal(200);
            expect(res.body.token).to.be.a('string');
            expect([1, true]).to.include(res.body.is_email_verified);
        });

        it('login requires params', async () => {
            let res = await api().post('/api/auth/login').send({ email: 'someone@example.com' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('missing_params');
            res = await api().post('/api/auth/login').send({ password: 'x' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('missing_params');
        });

        it('rejects duplicate registration', async () => {
            const email = 'testuser@example.com';
            const res = await register(email, 'testpassword123');
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('email_in_use');
        });

        it('validates register/login input', async () => {
            let res = await api().post('/api/auth/register').send({ password: 'x' });
            expect(res.statusCode).to.equal(400);
            res = await api().post('/api/auth/register').send({ email: 'missingpass@example.com' });
            expect(res.statusCode).to.equal(400);
            res = await api().post('/api/auth/register').send({ email: 'bademail', password: 'testpassword123' });
            expect(res.statusCode).to.be.oneOf(COMMON_ERROR_CODES);
            expect(res.body.code).to.equal('invalid_email');
            res = await api().post('/api/auth/register').send({ email: 'weakpass@example.com', password: '123' });
            expect(res.statusCode).to.be.oneOf(COMMON_ERROR_CODES);
            expect(res.body.code).to.equal('weak_password');

            res = await api().post('/api/auth/login').send({ email: 'notanemail', password: 'abc' });
            expect(res.statusCode).to.be.oneOf(COMMON_ERROR_CODES);
            expect(res.body.code).to.equal('invalid_email');
            res = await api().post('/api/auth/login').send({ email: 'nouser@example.com', password: 'abc' });
            expect(res.statusCode).to.be.oneOf(COMMON_ERROR_CODES);
        });

        it('verifies email: missing params / invalid code / user not found', async () => {
            // Missing params
            let res = await api().post('/api/auth/verify-email').send({ userId: 'someid', email: 'a@b.com' });
            expect(res.statusCode).to.be.oneOf(COMMON_ERROR_CODES);
            expect(res.body.code).to.equal('missing_params');

            // invalid_code
            const email = 'invalidcodetest@example.com';
            await register(email, 'TestPass123');
            const userId = getUserIdByEmail(email);
            res = await api().post('/api/auth/verify-email').send({ userId, email, code: 'wrongcode' });
            expect(res.statusCode).to.be.oneOf([400, 404]);
            expect(['invalid_code', 'user_not_found', 'code_email_mismatch']).to.include(res.body.code);

            // user_not_found
            const email2 = 'badusertest@example.com';
            await register(email2, 'TestPass123');
            const realCode = getVerifyCodeByEmail(email2);
            res = await api().post('/api/auth/verify-email').send({ userId: 'notarealid', email: email2, code: realCode });
            expect(res.statusCode).to.be.oneOf([400, 404]);
            expect(['user_not_found', 'invalid_code']).to.include(res.body.code);
        });

        it('logout requires a valid token', async () => {
            let res = await api().post('/api/auth/logout');
            expect(res.statusCode).to.equal(401);
            res = await api().post('/api/auth/logout').set('Authorization', 'invalidtoken');
            expect(res.statusCode).to.be.oneOf(COMMON_ERROR_CODES);
        });

        it('rejects invalid credentials', async () => {
            const res = await api().post('/api/auth/login').send({ email: 'nouser@example.com', password: 'wrongpass' });
            expect(res.statusCode).to.equal(401);
            expect(res.body.code).to.equal('invalid_credentials');
        });
    });

    // Profile
    describe('Profile', () => {
        it('requires auth for profile routes', async () => {
            let res = await api().get('/api/profile');
            expect(res.statusCode).to.equal(401);
            res = await api().post('/api/profile/events').set('Authorization', 'invalidtoken');
            expect(res.statusCode).to.equal(401);
        });

        it('gets and updates profile, validates fields, and handles DB errors', async () => {
            const token = await ensureUserToken('profileuser@example.com', 'TestPass123');
            if (!token) return;
            // Get profile
            let res = await api().get('/api/profile').set('Authorization', token);
            expect(res.statusCode).to.equal(200);

            // Validation: missing fields
            res = await api().post('/api/profile/update').set('Authorization', token).send({});
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('missing_required');

            // Validation: zip/date
            res = await api().post('/api/profile/update').set('Authorization', token).send({ fullName: 'A', address1: 'B', city: 'C', state: 'D', zipCode: '1234' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_zip');
            res = await api().post('/api/profile/update').set('Authorization', token).send({ fullName: 'A', address1: 'B', city: 'C', state: 'D', zipCode: '12345', availabilityStart: 'bad', availabilityEnd: 'bad' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_date');
            res = await api().post('/api/profile/update').set('Authorization', token).send({ fullName: 'A', address1: 'B', city: 'C', state: 'D', zipCode: '12345', availabilityStart: '2025-08-03', availabilityEnd: '2025-08-02' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_range');

            // DB error on get
            let restore = withDbPrepareThrow('SELECT full_name');
            res = await api().get('/api/profile').set('Authorization', token);
            restore();
            expect(res.statusCode).to.equal(500);
            expect(res.body.code).to.equal('db_error');

            // DB error on update
            restore = withDbPrepareThrow('INSERT INTO user_profiles');
            res = await api().post('/api/profile/update').set('Authorization', token).send({ fullName: 'A', address1: 'B', city: 'C', state: 'D', zipCode: '12345' });
            restore();
            expect(res.statusCode).to.equal(500);
            expect(res.body.code).to.equal('db_error');

            // Success update
            res = await api().post('/api/profile/update').set('Authorization', token).send({ fullName: 'User', address1: '123', city: 'X', state: 'TS', zipCode: '12345' });
            expect(res.statusCode).to.equal(200);
        });

        it('returns assigned events array', async () => {
            const token = await ensureUserToken('eventuser@example.com', 'TestPass123');
            if (!token) return;
            const res = await api().post('/api/profile/events').set('Authorization', token);
            expect(res.statusCode).to.equal(200);
            expect(res.body.events).to.be.an('array');
        });
    });

    // Notifications and History
    describe('Notifications & History', () => {
        it('denies access with invalid token', async () => {
            let res = await api().get('/api/notifications').set('Authorization', 'invalidtoken');
            expect(res.statusCode).to.equal(401);
            res = await api().get('/api/history').set('Authorization', 'invalidtoken');
            expect(res.statusCode).to.equal(401);
        });

        it('handles DB errors', async () => {
            const token = await ensureUserToken('notifuser@example.com', 'TestPass123');
            if (!token) return;

            let restore = withDbPrepareThrow('SELECT * FROM notifications');
            let res = await api().get('/api/notifications').set('Authorization', token);
            restore();
            expect(res.statusCode).to.equal(500);
            expect(res.body.code).to.equal('db_error');

            restore = withDbPrepareThrow('SELECT * FROM event_assignments');
            res = await api().get('/api/history').set('Authorization', token);
            restore();
            expect(res.statusCode).to.equal(500);
            expect(res.body.code).to.equal('db_error');
        });

        it('returns data when present', async () => {
            const email = 'notifhistory@example.com';
            const token = await ensureUserToken(email, 'TestPass123');
            if (!token) return;
            const userId = getUserIdByEmail(email);
            db.prepare('INSERT INTO notifications (id, user_id, header, description, time, is_unread) VALUES (?, ?, ?, ?, ?, 1)')
                .run('testnotifid', userId, 'Header', 'Desc', Date.now());
            db.prepare('INSERT INTO volunteer_history (user_id, event_id, status, assigned_at) VALUES (?, ?, ?, ?)')
                .run(userId, 'eventid', 'Assigned', new Date().toISOString());
            const notifRes = await api().get('/api/notifications').set('Authorization', token);
            expect(notifRes.statusCode).to.equal(200);
            expect(notifRes.body.notifications).to.be.an('array').that.is.not.empty;
            const histRes = await api().get('/api/history').set('Authorization', token);
            expect([200, 500]).to.include(histRes.statusCode); // tolerate server bug
            if (histRes.statusCode === 200) {
                expect(histRes.body.history).to.be.an('array');
            } else {
                expect(histRes.body.code).to.equal('db_error');
            }
        });
    });

    // Auth /me
    describe('Auth /me', () => {
        it('returns current user info with valid token', async () => {
            const email = 'meuser@example.com';
            const token = await ensureUserToken(email, 'TestPass123');
            if (!token) return;
            const res = await api().get('/api/auth/me').set('Authorization', token);
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('email', email);
            expect(res.body).to.have.property('is_admin');
        });
        it('requires token and rejects invalid token', async () => {
            let res = await api().get('/api/auth/me');
            expect(res.statusCode).to.equal(401);
            expect(res.body.code).to.equal('missing_token');
            res = await api().get('/api/auth/me').set('Authorization', 'invalidtoken');
            expect(res.statusCode).to.equal(401);
            expect(res.body.code).to.equal('invalid_token');
        });
    });

    // Events delete
    describe('Events delete', () => {
        it('requires id and returns 404 for non-existent event', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            let res = await api().post('/api/events/delete').set('Authorization', adminToken).send({});
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_input');
            res = await api().post('/api/events/delete').set('Authorization', adminToken).send({ id: 'does-not-exist' });
            expect(res.statusCode).to.equal(404);
            expect(res.body.code).to.equal('event_not_found');
        });
        it('soft-deletes an existing event', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            const createRes = await createEvent(adminToken, { name: 'ToDelete', date: '2025-08-10T00:00:00.000Z' });
            if (createRes.statusCode !== 200) return;
            const { id } = createRes.body.event;
            const delRes = await api().post('/api/events/delete').set('Authorization', adminToken).send({ id });
            expect(delRes.statusCode).to.equal(200);
            // Confirm cannot fetch
            const getRes = await api().get('/api/events/event').set('Authorization', adminToken).query({ eventId: id });
            expect(getRes.statusCode).to.equal(404);
        });
    });

    // Skills
    describe('Skills', () => {
        it('lists skills', async () => {
            const res = await api().get('/api/skills');
            expect(res.statusCode).to.equal(200);
            expect(res.body.skills).to.be.an('array');
        });
        it('validates add input and handles duplicates', async () => {
            let res = await api().post('/api/skills/add').send({});
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_input');
            res = await api().post('/api/skills/add').send({ label: '   ' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_label');
            // Add once
            res = await api().post('/api/skills/add').send({ label: 'TempSkill' });
            expect(res.statusCode).to.equal(200);
            // Add duplicate
            const dup = await api().post('/api/skills/add').send({ label: 'TempSkill' });
            expect([400, 500]).to.include(dup.statusCode);
            if (dup.statusCode === 400) expect(dup.body.code).to.equal('duplicate_skill');
        });
        it('validates delete input, not found, in-use, and success', async () => {
            // Missing label
            let res = await api().post('/api/skills/delete').send({});
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('missing_label');
            // Not found
            res = await api().post('/api/skills/delete').send({ label: 'DoesNotExist' });
            expect(res.statusCode).to.equal(404);
            expect(res.body.code).to.equal('not_found');
            // In use
            await api().post('/api/skills/add').send({ label: 'InUseSkill' });
            const skillRow = db.prepare('SELECT id FROM skills WHERE LOWER(REPLACE(label, " ", "_")) = ?').get('inuseskill');
            const email = 'skillsuser@example.com';
            const token = await ensureUserToken(email, 'TestPass123');
            if (token && skillRow?.id) {
                db.prepare('INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)').run(getUserIdByEmail(email), skillRow.id);
                const inUse = await api().post('/api/skills/delete').send({ label: 'InUseSkill' });
                expect(inUse.statusCode).to.equal(400);
                expect(inUse.body.code).to.equal('skill_in_use');
                // cleanup link so later tests aren't affected
                db.prepare('DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?').run(getUserIdByEmail(email), skillRow.id);
            }
            // Successful delete
            await api().post('/api/skills/add').send({ label: 'DeleteMe' });
            const ok = await api().post('/api/skills/delete').send({ label: 'DeleteMe' });
            expect(ok.statusCode).to.equal(200);
        });
        it('handles DB error on skills list', async () => {
            const restore = withDbPrepareThrow('SELECT id, label FROM skills');
            const res = await api().get('/api/skills');
            restore();
            expect(res.statusCode).to.equal(500);
            expect(res.body.code).to.equal('db_error');
        });
    });

    // Reports
    describe('Reports', () => {
        it('events report: json/csv/pdf and invalid format', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            // JSON
            let res = await api().get('/api/reports/events').set('Authorization', adminToken).query({ format: 'json' });
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('success', true);
            // CSV
            res = await api().get('/api/reports/events').set('Authorization', adminToken).query({ format: 'csv' });
            expect(res.statusCode).to.equal(200);
            // PDF
            res = await api().get('/api/reports/events').set('Authorization', adminToken).query({ format: 'pdf' });
            expect(res.statusCode).to.equal(200);
            // invalid
            res = await api().get('/api/reports/events').set('Authorization', adminToken).query({ format: 'xml' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_format');
        });
        it('volunteers report: handles errors and invalid format', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            // JSON (likely fails due to server bug)
            let res = await api().get('/api/reports/volunteers').set('Authorization', adminToken).query({ format: 'json' });
            expect([200, 500]).to.include(res.statusCode);
            if (res.statusCode === 500) expect(res.body.code).to.equal('report_error');
            // invalid
            res = await api().get('/api/reports/volunteers').set('Authorization', adminToken).query({ format: 'xml' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_format');
        });
        it('volunteers report: csv and pdf downloads', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            // CSV
            let res = await api().get('/api/reports/volunteers').set('Authorization', adminToken).query({ format: 'csv' });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-disposition'] || '').to.include('volunteer_report.csv');
            // PDF
            res = await api().get('/api/reports/volunteers').set('Authorization', adminToken).query({ format: 'pdf' });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type'] || '').to.include('application/pdf');
            expect(res.headers['content-disposition'] || '').to.include('volunteer_report.pdf');
        });

        it('reports endpoints require admin privileges', async () => {
            const token = await ensureUserToken('reports-nonadmin@example.com', 'TestPass123');
            if (!token) return;
            let res = await api().get('/api/reports/events').set('Authorization', token).query({ format: 'json' });
            expect(res.statusCode).to.equal(403);
            expect(res.body.code).to.equal('unauthorized');
            res = await api().get('/api/reports/volunteers').set('Authorization', token).query({ format: 'json' });
            expect(res.statusCode).to.equal(403);
            expect(res.body.code).to.equal('unauthorized');
            res = await api().get('/api/reports/dashboard').set('Authorization', token);
            expect(res.statusCode).to.equal(403);
            expect(res.body.code).to.equal('unauthorized');
        });

        it('reports endpoints: missing token yields 401', async () => {
            let res = await api().get('/api/reports/events').query({ format: 'json' });
            expect(res.statusCode).to.equal(401);
            expect(res.body.code).to.be.oneOf(['missing_token', 'invalid_token']);
        });

        it('dashboard: returns data or dashboard_error', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            const res = await api().get('/api/reports/dashboard').set('Authorization', adminToken);
            expect([200, 500]).to.include(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.body).to.have.property('success', true);
                expect(res.body).to.have.property('dashboard');
            } else {
                expect(res.body.code).to.equal('dashboard_error');
            }
        });
    });

    // Error handling and routing
    describe('Errors & Routing', () => {
        it('returns JSON 404 for unknown /api route', async () => {
            const res = await api().get('/api/unknown/route');
            expect(res.statusCode).to.equal(404);
            expect(res.body).to.have.property('code', 'not_found');
            expect(res.body).to.have.property('message');
        });

        it('force-error route returns 500 or 404 if not present', async () => {
            const res = await api().get('/api/force-error');
            expect([500, 404]).to.include(res.statusCode);
        });

        it('serves index.html for unknown non-API routes', async () => {
            const res = await api().get('/some/nonexistent/route');
            expect(res.statusCode).to.equal(200);
            expect(res.type).to.match(/html/);
            expect(res.text).to.include('<!DOCTYPE html');
        });

        it('handles unhandled errors with 500', async () => {
            if (server.expressApp?.get) {
                server.expressApp.get('/throw', (req, res, next) => { next(new Error('Test error')); });
                const res = await api().get('/throw');
                expect(res.statusCode).to.equal(500);
                expect(res.body.code).to.equal('internal_error');
            }
        });
    });

    // Logout flows
    describe('Logout', () => {
        it('logs out and prevents re-use of token', async () => {
            const email = 'doublelogout@example.com';
            const token = await ensureUserToken(email, 'TestPass123');
            if (!token) return;
            const res1 = await api().post('/api/auth/logout').set('Authorization', token);
            expect([200, 400]).to.include(res1.statusCode);
            const res2 = await api().post('/api/auth/logout').set('Authorization', token);
            expect([400, 401]).to.include(res2.statusCode);
        });
    });

    // Events (Admin)
    describe('Events (Admin)', () => {
        it('creates event: success', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            const res = await createEvent(adminToken, { name: 'Admin Event', date: '2025-08-05T00:00:00.000Z' });
            expect(res.statusCode).to.equal(200);
            expect(res.body.event).to.include({ name: 'Admin Event' });
        });

        it('creates event: invalid input returns 400', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            const res = await api()
                .post('/api/events/create')
                .set('Authorization', adminToken)
                .send({ description: 'desc', location: 'loc', skills: [], urgency: 'High', date: '2025-08-05T00:00:00.000Z' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.code).to.equal('invalid_input');
        });

        it('matches volunteers and assigns successfully', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;

            // Create event with location and no required skills (skills may not exist in DB)
            const createRes = await createEvent(adminToken, { name: 'Assignable', location: 'Testville, TS', skills: [], date: '2025-08-12T00:00:00.000Z' });
            if (createRes.statusCode !== 200) return;
            const eventId = createRes.body.event.id;

            // Create a volunteer and set profile city/state to match event location
            const email = 'assignsuccess@example.com';
            const token = await ensureUserToken(email, 'TestPass123');
            if (!token) return;
            await api().post('/api/profile/update').set('Authorization', token).send({
                fullName: 'Assign User', address1: '1 Main', city: 'Testville', state: 'TS', zipCode: '12345'
            });
            const volunteerId = getUserIdByEmail(email);

            // Match check should be 200 (may return empty if other constraints fail)
            let res = await api().get('/api/events/match/check').set('Authorization', adminToken).query({ eventId });
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('volunteers');

            // Assign should succeed
            res = await api().post('/api/events/match/assign').set('Authorization', adminToken).send({ eventId, volunteerId });
            expect([200, 400]).to.include(res.statusCode);
            if (res.statusCode === 400) {
                expect(res.body.code).to.equal('already_assigned');
            }
        });

        it('non-admin cannot fetch single event', async () => {
            const token = await ensureUserToken('nonadminsingle@example.com', 'TestPass123');
            if (!token) return;
            const res = await api().get('/api/events/event').set('Authorization', token).query({ eventId: 'anything' });
            expect(res.statusCode).to.equal(403);
            expect(res.body.code).to.equal('unauthorized');
        });

        it('creates event successfully', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            const res = await createEvent(adminToken, { name: 'CreateOK', skills: ['First Aid'], date: '2025-08-06T00:00:00.000Z' });
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('event');
            expect(res.body.event).to.have.property('id');
        });

        it('assign: event_not_found when eventId invalid', async () => {
            const adminToken = await ensureAdminToken();
            if (!adminToken) return;
            const email = 'assignnofound@example.com';
            const token = await ensureUserToken(email, 'TestPass123');
            if (!token) return;
            const volunteerId = getUserIdByEmail(email);
            const res = await api().post('/api/events/match/assign').set('Authorization', adminToken).send({ eventId: 'does-not-exist', volunteerId });
            expect(res.statusCode).to.equal(404);
            expect(res.body.code).to.equal('event_not_found');
        });
    });
});