# COSC 4353 Group 13 Project

To run this project:
1. Clone the repository
2. Ensure you have [Node.js](https://nodejs.org/en) installed
3. Run `npm install` to install dependencies
4. Run `npm start` to start the server
5. Navigate to <http://localhost:3000> to access the webapp

## Problem Statement

A non-profit organization has requested to build a software application that will help manage and optimize their volunteer activities. The application should help the organization efficiently allocate volunteers to different events and tasks based on their preferences, skills, and availability. The application should consider the following criteria:

- Volunteer’s location
- Volunteer’s skills and preferences
- Volunteer’s availability
- Event requirements and location
- Task urgency and priority

The software must include the following components:

1. Login (Allow volunteers and administrators to register if not already registered)
1. User Registration (Initially only username and password, followed by email verification)
1. User Profile Management (After registration, users should log in to complete their profile, including location, skills, preferences, and availability)
1. Event Management (Administrators can create and manage events, specifying required skills, location, and urgency)
1. Volunteer Matching (A module that matches volunteers to events/tasks based on their profiles and the event requirements)
1. Notification System (Send notifications to volunteers for event assignments, updates, and reminders)
1. Volunteer History (Track volunteer participation history and performance)

---

## API Documentation

All endpoints are prefixed with `/api/`. All requests and responses are in JSON. Some endpoints require authentication via an `Authorization` header containing a valid session token.

### Authentication

#### POST `/api/auth/register`
Register a new user.
- **Body:** `{ email: string, password: string }`
- **Responses:**
  - `200 OK` `{ success: true, user: { ... } }`
  - `400` for missing/invalid fields, duplicate email, weak password

#### POST `/api/auth/login`
Login with email and password.
- **Body:** `{ email: string, password: string }`
- **Responses:**
  - `200 OK` `{ success: true, token, userId, email }`
  - `403` if email not verified (`code: 'email_not_verified'`)
  - `401/400` for invalid credentials or missing fields

#### POST `/api/auth/logout`
Logout the current session.
- **Headers:** `Authorization: <token>`
- **Responses:**
  - `200 OK` `{ success: true }`
  - `400/401` for invalid/missing token

#### POST `/api/auth/verify-email`
Verify a user's email with a code.
- **Body:** `{ userId: string, email: string, code: string }`
- **Responses:**
  - `200 OK` `{ success: true, message }`
  - `400/404` for missing/invalid params, code mismatch, or user not found

#### GET `/api/auth/me`
Get current user info (requires login).
- **Headers:** `Authorization: <token>`
- **Responses:** `{ success: true, userId, email, is_email_verified, is_admin }`

---

### User Profile

#### GET `/api/profile`
Get the current user's profile.
- **Headers:** `Authorization: <token>`
- **Responses:** `{ success: true, profile: { ... } }`

#### POST `/api/profile/update`
Update the current user's profile.
- **Headers:** `Authorization: <token>`
- **Body:** `{ fullName, address1, address2, city, state, zipCode, skills, preferences, availabilityStart, availabilityEnd }`
- **Responses:**
  - `200 OK` `{ success: true, message }`
  - `400` for invalid zip, date, or range

#### POST `/api/profile/events`
Get events assigned to the current user.
- **Headers:** `Authorization: <token>`
- **Responses:** `{ success: true, events: [ ... ] }`

---

### Events (Admin Only)

#### GET `/api/events`
Get all events (admin only).
- **Headers:** `Authorization: <admin token>`
- **Responses:** `{ success: true, events: [ ... ] }`

#### POST `/api/events/create`
Create a new event (admin only).
- **Headers:** `Authorization: <admin token>`
- **Body:** `{ name, description, location, skills, urgency, date }`
- **Responses:** `{ success: true, event: { ... } }`

#### POST `/api/events/update`
Update an event (admin only).
- **Headers:** `Authorization: <admin token>`
- **Body:** `{ id, name, description, location, skills, urgency, date }`
- **Responses:** `{ success: true, event: { ... } }`

#### GET `/api/events/event?eventId=...`
Get a single event by ID.
- **Headers:** `Authorization: <token>`
- **Query:** `eventId`
- **Responses:** `{ success: true, event: { ... } }`

#### GET `/api/events/match/check?eventId=...`
Get volunteers matching an event (admin only).
- **Headers:** `Authorization: <admin token>`
- **Query:** `eventId`
- **Responses:** `{ success: true, volunteers: [ ... ] }`

#### POST `/api/events/match/assign`
Assign a volunteer to an event (admin only).
- **Headers:** `Authorization: <admin token>`
- **Body:** `{ eventId, volunteerId }`
- **Responses:** `{ success: true, message }`

---

### Notifications & History

#### GET `/api/notifications`
Get notifications for the current user.
- **Headers:** `Authorization: <token>`
- **Responses:** `{ success: true, notifications: [ ... ] }`

#### GET `/api/history`
Get volunteer history for the current user.
- **Headers:** `Authorization: <token>`
- **Responses:** `{ success: true, history: [ ... ] }`

---

### Reports (Admin Only)

#### GET `/api/reports/volunteers`
Generate comprehensive volunteer participation report.
- **Headers:** `Authorization: <admin token>` (required)
- **Query Parameters:** 
  - `format`: `json` | `csv` | `pdf` (optional, defaults to `json`)
- **Responses:**
  - `200 OK` (JSON): `{ success: true, report_type: 'volunteers', volunteers: [...] }`
  - `200 OK` (CSV): Downloads CSV file with volunteer data
  - `200 OK` (PDF): Downloads PDF report with formatted volunteer information
  - `403` if not admin
  - `401` if not authenticated
  - `500` if report generation fails

**Example Request:**
```bash
# Get JSON data
curl -H "Authorization: <token>" http://localhost:3000/api/reports/volunteers?format=json

# Download PDF
curl -H "Authorization: <token>" http://localhost:3000/api/reports/volunteers?format=pdf -o volunteer_report.pdf

# Download CSV
curl -H "Authorization: <token>" http://localhost:3000/api/reports/volunteers?format=csv -o volunteer_report.csv

---

### Error Handling
All error responses have the form:
```
{ success: false, code: string, message: string }
```
See test cases for possible error codes.
