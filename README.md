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