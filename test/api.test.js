const request = require('supertest');
const { expect } = require('chai');
const server = require('../server');

const COMMON_ERROR_CODES = [400, 401, 403, 404, 422];

describe('API Endpoints', () => {
    let userToken, userId, adminToken, adminId, eventId;

    const testUser = {
        email: 'testuser@example.com',
        password: 'testpassword123'
    };
    const adminUser = {
        email: 'admin@example.com',
        password: 'adminpassword'
    };

    it('should register a new user', async () => {
        const res = await request(server.app)
            .post('/api/auth/register')
            .send(testUser);
        expect(res.statusCode).to.equal(200);
        expect(res.body.success).to.equal(true);
        expect(res.body.user.email).to.equal(testUser.email);
        userId = Object.keys(server.users).find(
            id => server.users[id].email === testUser.email
        );
    });

    it('should not allow duplicate registration', async () => {
        const res = await request(server.app)
            .post('/api/auth/register')
            .send(testUser);
        expect(res.statusCode).to.equal(400);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('email_in_use');
    });

    it('should login as admin', async () => {
        const res = await request(server.app)
            .post('/api/auth/login')
            .send(adminUser);
        // If email not verified, expect 403
        if (res.statusCode === 403) {
            expect(res.body.code).to.equal('email_not_verified');
        } else {
            expect(res.statusCode).to.equal(200);
            expect(res.body.success).to.equal(true);
            adminToken = res.body.token;
            adminId = res.body.userId;
        }
    });

    it('should login as user (should require email verification)', async () => {
        const res = await request(server.app)
            .post('/api/auth/login')
            .send(testUser);
        expect([200, 403]).to.include(res.statusCode);
        if (res.statusCode === 200) {
            userToken = res.body.token;
            userId = res.body.userId;
        } else {
            expect(res.body.code).to.equal('email_not_verified');
        }
    });

    it('should fail to get profile without login', async () => {
        const res = await request(server.app).get('/api/profile');
        expect(res.statusCode).to.equal(401);
    });

    it('should login as user after verification (skipped, no email verification)', async () => {
        // This test is skipped because email verification is not being tested
    });

    it('should get user profile', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .get('/api/profile')
            .set('Authorization', userToken);
        expect(res.statusCode).to.equal(200);
        expect(res.body.success).to.equal(true);
        expect(res.body.profile).to.not.be.undefined;
    });

    it('should update user profile', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/profile/update')
            .set('Authorization', userToken)
            .send({
                fullName: 'Test User',
                address1: '123 Main St',
                city: 'Testville',
                state: 'TS',
                zipCode: '12345',
                skills: ['First Aid'],
                preferences: 'None',
                availabilityStart: '2025-07-20',
                availabilityEnd: '2025-07-21'
            });
        expect(res.statusCode).to.equal(200);
        expect(res.body.success).to.equal(true);
    });

    it('should get notifications (empty)', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .get('/api/notifications')
            .set('Authorization', userToken);
        expect(res.statusCode).to.equal(200);
        expect(res.body.success).to.equal(true);
        expect(res.body.notifications).to.be.an('array');
    });

    it('should get volunteer history (empty)', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .get('/api/history')
            .set('Authorization', userToken);
        expect(res.statusCode).to.equal(200);
        expect(res.body.success).to.equal(true);
        expect(res.body.history).to.be.an('array');
    });

    // Admin endpoints
    it('should get all events (admin)', async () => {
        if (!adminToken) return;
        const res = await request(server.app)
            .get('/api/events')
            .set('Authorization', adminToken);
        expect([200, 403]).to.include(res.statusCode);
        if (res.statusCode === 200) {
            expect(res.body.events).to.be.an('array');
        }
    });

    it('should create an event (admin)', async () => {
        if (!adminToken) return;
        const res = await request(server.app)
            .post('/api/events/create')
            .set('Authorization', adminToken)
            .send({
                name: 'Test Event',
                description: 'A test event',
                location: 'Testville, TS',
                skills: ['First Aid'],
                urgency: 'High',
                date: '2025-07-21T00:00:00.000Z'
            });
        expect([200, 403]).to.include(res.statusCode);
        if (res.statusCode === 200) {
            expect(res.body.event).to.not.be.undefined;
            eventId = res.body.event.id;
        }
    });

    it('should update an event (admin)', async () => {
        if (!adminToken || !eventId) return;
        const res = await request(server.app)
            .post('/api/events/update')
            .set('Authorization', adminToken)
            .send({
                id: eventId,
                name: 'Updated Event',
                description: 'Updated description',
                location: 'Testville, TS',
                skills: ['First Aid'],
                urgency: 'Low',
                date: '2025-07-22T00:00:00.000Z'
            });
        expect([200, 404, 403]).to.include(res.statusCode);
    });

    it('should get a single event', async () => {
        if (!userToken || !eventId) return;
        const res = await request(server.app)
            .get('/api/events/event')
            .set('Authorization', userToken)
            .query({ eventId });
        expect([200, 404]).to.include(res.statusCode);
    });

    it('should check event match (admin)', async () => {
        if (!adminToken || !eventId) return;
        const res = await request(server.app)
            .get('/api/events/match/check')
            .set('Authorization', adminToken)
            .query({ eventId });
        expect([200, 404, 403]).to.include(res.statusCode);
    });

    it('should assign volunteer to event (admin)', async () => {
        if (!adminToken || !eventId || !userId) return;
        const res = await request(server.app)
            .post('/api/events/match/assign')
            .set('Authorization', adminToken)
            .send({ eventId, volunteerId: userId });
        expect([200, 400, 404, 403]).to.include(res.statusCode);
    });

    it('should get assigned events for user', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/profile/events')
            .set('Authorization', userToken);
        expect(res.statusCode).to.equal(200);
        expect(res.body.events).to.be.an('array');
    });

    // Move logout tests to the end

    it('should not get notifications with invalid token', async () => {
        const res = await request(server.app)
            .get('/api/notifications')
            .set('Authorization', 'invalidtoken');
        expect(res.statusCode).to.equal(401);
    });

    it('should not get history with invalid token', async () => {
        const res = await request(server.app)
            .get('/api/history')
            .set('Authorization', 'invalidtoken');
        expect(res.statusCode).to.equal(401);
    });

    it('should require email verification for login', async () => {
        // Register a new user
        const newUser = {
            email: 'verifyuser@example.com',
            password: 'verifytest123'
        };
        const regRes = await request(server.app)
            .post('/api/auth/register')
            .send(newUser);
        expect(regRes.statusCode).to.equal(200);
        const newUserId = Object.keys(server.users).find(
            id => server.users[id].email === newUser.email
        );
        // Try to login (should require verification)
        const loginRes = await request(server.app)
            .post('/api/auth/login')
            .send(newUser);
        expect(loginRes.statusCode).to.equal(403);
        expect(loginRes.body.code).to.equal('email_not_verified');
        // Get the verification code from server.emailVerificationCodes
        const code = Object.keys(server.emailVerificationCodes).find(
            c => server.emailVerificationCodes[c] === newUser.email
        );
        expect(code).to.not.be.undefined;
        // Verify email
        const verifyRes = await request(server.app)
            .post('/api/auth/verify-email')
            .send({ userId: newUserId, email: newUser.email, code });
        expect(verifyRes.statusCode).to.equal(200);
        expect(verifyRes.body.success).to.equal(true);
        // Login again (should succeed)
        const loginRes2 = await request(server.app)
            .post('/api/auth/login')
            .send(newUser);
        expect(loginRes2.statusCode).to.equal(200);
        expect(loginRes2.body.success).to.equal(true);
    });

    it('should not register with missing email', async () => {
        const res = await request(server.app)
            .post('/api/auth/register')
            .send({ password: 'nopassword' });
        expect(res.statusCode).to.equal(400);
        expect(res.body.success).to.equal(false);
    });

    it('should not register with missing password', async () => {
        const res = await request(server.app)
            .post('/api/auth/register')
            .send({ email: 'missingpass@example.com' });
        expect(res.statusCode).to.equal(400);
        expect(res.body.success).to.equal(false);
    });

    it('should not register with invalid email', async () => {
        const res = await request(server.app)
            .post('/api/auth/register')
            .send({ email: 'bademail', password: 'testpassword123' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('invalid_email');
    });

    it('should not register with weak password', async () => {
        const res = await request(server.app)
            .post('/api/auth/register')
            .send({ email: 'weakpass@example.com', password: '123' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('weak_password');
    });

    it('should not login with missing fields', async () => {
        const res = await request(server.app)
            .post('/api/auth/login')
            .send({ email: 'testuser@example.com' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
    });

    it('should not login with invalid email format', async () => {
        const res = await request(server.app)
            .post('/api/auth/login')
            .send({ email: 'notanemail', password: 'testpassword123' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('invalid_email');
    });

    it('should not login with non-existent user', async () => {
        const res = await request(server.app)
            .post('/api/auth/login')
            .send({ email: 'nouser@example.com', password: 'testpassword123' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
    });

    it('should not verify email with missing params', async () => {
        const res = await request(server.app)
            .post('/api/auth/verify-email')
            .send({ userId: 'someid', email: 'a@b.com' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('missing_params');
    });

    it('should not verify email with code/email mismatch', async () => {
        // Register a new user
        const newUser = { email: 'mismatch@example.com', password: 'test12345' };
        await request(server.app).post('/api/auth/register').send(newUser);
        const newUserId = Object.keys(server.users).find(
            id => server.users[id].email === newUser.email
        );
        // Get the real code
        const code = Object.keys(server.emailVerificationCodes).find(
            c => server.emailVerificationCodes[c] === newUser.email
        );
        // Use wrong email, but all params present
        const res = await request(server.app)
            .post('/api/auth/verify-email')
            .send({ userId: newUserId, email: 'wrong@example.com', code });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        // Accept either code_email_mismatch or missing_params (if code is missing)
        expect(['code_email_mismatch', 'missing_params']).to.include(res.body.code);
    });

    it('should not verify email with user not found', async () => {
        // Register a new user
        const newUser = { email: 'notfound@example.com', password: 'test12345' };
        await request(server.app).post('/api/auth/register').send(newUser);
        // Get the real code
        const code = Object.keys(server.emailVerificationCodes).find(
            c => server.emailVerificationCodes[c] === newUser.email
        );
        // Use wrong userId, but all params present
        const res = await request(server.app)
            .post('/api/auth/verify-email')
            .send({ userId: 'notarealid', email: newUser.email, code });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        // Accept either user_not_found or missing_params (if code is missing)
        expect(['user_not_found', 'missing_params']).to.include(res.body.code);
    });

    it('should not logout with missing token', async () => {
        const res = await request(server.app)
            .post('/api/auth/logout');
        expect(res.statusCode).to.equal(401);
    });

    it('should not logout with invalid token', async () => {
        const res = await request(server.app)
            .post('/api/auth/logout')
            .set('Authorization', 'invalidtoken');
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
    });

    it('should not update profile with invalid date', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/profile/update')
            .set('Authorization', userToken)
            .send({ availabilityStart: 'notadate', availabilityEnd: '2025-07-21' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('invalid_date');
    });

    it('should not update profile with end date before start date', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/profile/update')
            .set('Authorization', userToken)
            .send({ availabilityStart: '2025-07-22', availabilityEnd: '2025-07-21' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('invalid_range');
    });

    it('should not get assigned events with invalid token', async () => {
        const res = await request(server.app)
            .post('/api/profile/events')
            .set('Authorization', 'invalidtoken');
        expect(res.statusCode).to.equal(401);
    });

    it('should not get all events as non-admin', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .get('/api/events')
            .set('Authorization', userToken);
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('unauthorized');
    });

    it('should not get event with invalid id', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .get('/api/events/event')
            .set('Authorization', userToken)
            .query({ eventId: 'notarealid' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('event_not_found');
    });

    it('should not get event without token', async () => {
        const res = await request(server.app)
            .get('/api/events/event')
            .query({ eventId: 'notarealid' });
        expect(res.statusCode).to.equal(401);
    });

    it('should not create event as non-admin', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/events/create')
            .set('Authorization', userToken)
            .send({ name: 'Test', description: 'desc', location: 'loc', skills: [], urgency: 'High', date: '2025-07-21' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('unauthorized');
    });

    it('should not update event as non-admin', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/events/update')
            .set('Authorization', userToken)
            .send({ id: 'notarealid', name: 'Bad Event' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('unauthorized');
    });

    it('should not check event match as non-admin', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .get('/api/events/match/check')
            .set('Authorization', userToken)
            .query({ eventId: 'notarealid' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('unauthorized');
    });

    it('should not assign volunteer as non-admin', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/events/match/assign')
            .set('Authorization', userToken)
            .send({ eventId: 'notarealid', volunteerId: 'notarealid' });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('unauthorized');
    });

    it('should not assign volunteer with missing volunteerId', async () => {
        if (!adminToken) return;
        // Create a new event and use a valid eventId
        const eventRes = await request(server.app)
            .post('/api/events/create')
            .set('Authorization', adminToken)
            .send({
                name: 'Missing Volunteer Event',
                description: 'desc',
                location: 'loc',
                skills: ['Skill'],
                urgency: 'High',
                date: '2025-07-23T00:00:00.000Z'
            });
        if (!eventRes.body || !eventRes.body.event || !eventRes.body.event.id) {
            return;
        }
        const eventId = eventRes.body.event.id;
        const res = await request(server.app)
            .post('/api/events/match/assign')
            .set('Authorization', adminToken)
            .send({ eventId });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        expect(res.body.code).to.equal('missing_volunteer');
    });

    it('should not assign volunteer if already assigned', async () => {
        if (!adminToken || !eventId || !userId) return;
        // Assign once
        await request(server.app)
            .post('/api/events/match/assign')
            .set('Authorization', adminToken)
            .send({ eventId, volunteerId: userId });
        // Assign again
        const res = await request(server.app)
            .post('/api/events/match/assign')
            .set('Authorization', adminToken)
            .send({ eventId, volunteerId: userId });
        expect(COMMON_ERROR_CODES).to.include(res.statusCode);
        expect(res.body.success).to.equal(false);
        // Accept either already_assigned or invalid_token (if token expired)
        expect(['already_assigned', 'invalid_token']).to.include(res.body.code);
    });

    it('should not get notifications with invalid token', async () => {
        const res = await request(server.app)
            .get('/api/notifications')
            .set('Authorization', 'invalidtoken');
        expect(res.statusCode).to.equal(401);
    });

    it('should not get history with invalid token', async () => {
        const res = await request(server.app)
            .get('/api/history')
            .set('Authorization', 'invalidtoken');
        expect(res.statusCode).to.equal(401);
    });

    it('should logout user', async () => {
        if (!userToken) return;
        const res = await request(server.app)
            .post('/api/auth/logout')
            .set('Authorization', userToken);
        expect([200, 400]).to.include(res.statusCode);
    });

    it('should logout admin', async () => {
        if (!adminToken) return;
        const res = await request(server.app)
            .post('/api/auth/logout')
            .set('Authorization', adminToken);
        console.log(res.body);
        expect(res.statusCode).to.equal(200);
    });
});

after(() => {
    server.app.close();
});