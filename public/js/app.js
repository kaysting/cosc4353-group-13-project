const elPageContainer = document.getElementById('page');

function render(elPageContent) {
    elPageContainer.innerHTML = '';
    elPageContainer.appendChild(elPageContent);
}

const routes = [

    // Home page (unused for now)
    {
        path: '/',
        handler: () => {
            const page = document.createElement('div');
            // ...
            render(page);
        }
    },

    // User registration form
    {
        path: '/register',
        handler: () => {
            const page = document.createElement('div');
            page.innerHTML = /*html*/`
                <form>
                    <div class="form-group">
                        <label for="registerName">Name</label>
                        <input type="text" id="registerName" class="form-control" placeholder="What should we call you?" required>
                        <small class="form-text text-muted">This is the name that volunteering coordinators will see.</small>
                    </div>
                    <div class="form-group">
                        <label for="registerEmail">Email</label>
                        <input type="email" id="registerEmail" class="form-control" placeholder="Enter your email" required>
                        <small class="form-text text-muted">We'll send volunteering notifications to this address.</small>
                    </div>
                    <div class="form-group">
                        <label for="registerPassword">Password</label>
                        <input type="password" id="registerPassword" class="form-control" placeholder="Enter your password" required>
                        <small class="form-text text-muted">Your password must be at least 8 characters long.</small>
                    </div>
                    <button type="registerSubmit">Register</button>
                </form>
            `;
            const inputName = page.querySelector('#registerName');
            const inputEmail = page.querySelector('#registerEmail');
            const inputPassword = page.querySelector('#registerPassword');
            const btnSubmit = page.querySelector('#registerSubmit');
            // Name must be between 3 and 50 characters
            inputName.addEventListener('input', () => {
                if (inputName.value.length < 3 || inputName.value.length > 50) {
                    inputName.setCustomValidity('Name must be between 3 and 50 characters');
                } else {
                    inputName.setCustomValidity('');
                }
            });
            // Email must be a valid email address
            inputEmail.addEventListener('input', () => {
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(inputEmail.value)) {
                    inputEmail.setCustomValidity('Please enter a valid email address');
                } else {
                    inputEmail.setCustomValidity('');
                }
            });
            // Password must be at least 8 characters long
            inputPassword.addEventListener('input', () => {
                if (inputPassword.value.length < 8) {
                    inputPassword.setCustomValidity('Password must be at least 8 characters long');
                } else {
                    inputPassword.setCustomValidity('');
                }
            });
            // Handle submit
            btnSubmit.addEventListener('click', (e) => {
                e.preventDefault();
                if (!inputName.checkValidity() || !inputEmail.checkValidity() || !inputPassword.checkValidity()) return;

                const name = inputName.value.trim();
                const email = inputEmail.value.trim();
                const password = inputPassword.value;

                // TODO: Interface with server...

                window.location.hash = '/login';
            });
            render(page);
        }
    },

    // User login form
    {
        path: '/login',
        handler: () => {
            const page = document.createElement('div');
            page.innerHTML = /*html*/`
                <h2>Login</h2>
                <form id="loginForm">
                    <div>
                    <label for="loginEmail">Email:</label>
                    <input type="email" id="loginEmail" required />
                    </div>
                    <div>
                    <label for="loginPassword">Password:</label>
                    <input type="password" id="loginPassword" required />
                    </div>
                    <button type="submit">Login</button>
                    <p id="loginMessage" style="color:red;"></p>
                </form>
            `;

            // submit event listener to the login form
            page.querySelector('#loginForm').addEventListener('submit', function (e) {
                // Prevent the form from submitting the default way
                e.preventDefault();

                // values entered in the email and password fields
                const email = page.querySelector('#loginEmail').value.trim(); // removes any leading/trailing spaces
                const password = page.querySelector('#loginPassword').value;

                // list of registered users from localStorage
                const users = JSON.parse(localStorage.getItem('users') || '[]');

                // find a user whose email and password match the input
                const user = users.find(u => u.email === email && u.password === password);

                // message (to display success/failure messages)
                const message = page.querySelector('#loginMessage');

                if (user) {
                    // If a matching user is found
                    message.style.color = 'green';
                    message.textContent = 'Login successful! Redirecting...';

                    setTimeout(() => {
                        window.location.hash = '/profile'; // Removed hash sign - Kayla
                    }, 1000);
                } else {
                    message.style.color = 'red';
                    message.textContent = 'Invalid email or password';
                }
            });
            render(page);
        }
    },

    // User profile editor form
    {
        path: '/profile',
        handler: () => {
            const page = document.createElement('div');
            page.innerHTML = /*html*/`
                <h1>User Profile</h1><br>
                <!-- Everything in read only, switched off and on by edit and save buttons.-->
                <form id="profileForm">
                    <label>Full Name:
                        <input type="text" id="fullName" maxlength="50" required readonly>
                    </label><br><br>

                    <label>Address 1:
                        <input type="text" id="address1" maxlength="100" required readonly>
                    </label><br><br>

                    <label>Address 2 (Optional):
                        <input type="text" id="address2" maxlength="100" readonly>
                    </label><br><br>

                    <label>City:
                        <input type="text" id="city" maxlength="100" required readonly>
                    </label>

                    <label>State:
                        <select id="state" required disabled>
                            <option value="">Select a state</option>
                            <option value="AZ">Arizona</option>
                            <option value="AK">Arkansas</option>
                            <option value="FL">Florida</option>
                            <option value="TX">Texas</option>
                            <!-- Add options for more states here-->
                        </select>
                    </label>

                    <label>Zip Code:
                        <input type="text" id="zipCode" maxlength="9" pattern=".{5,9}" required readonly>
                    </label><br><br><br>

                    <label>Skills:
                        <select id="skills" multiple required disabled>
                            <!-- Need to add more skills here-->
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                            <option value="javascript">JS</option>
                        </select>
                    </label><br><br>

                    <label>Preferences:
                        <textarea id="preferences" readonly></textarea>
                    </label><br><br><br>

                    <label>Availability:
                        <input type="date" id="availability" required readonly>
                    </label><br><br>

                    <button type="button" id="editButton">Edit</button>
                    <button type="submit" id="saveButton" style="display:none">Save</button>
                </form>
                `;
            //Testing purposes (Edit when Database is added, breaks after single use, reload page to try again)
            let userData = {
                fullName: "Placeholder Name",
                address1: "123 Street St",
                address2: "64 Apt",
                city: "Houston",
                state: "TX",
                zipCode: "77001",
                skills: ["html", "css"],
                preferences: "Prefers remote work",
                availability: "2025-07-01"
            };
            window.onload = function () {
                loadProfile();
                document.getElementById('editButton').addEventListener('click', enableEditing);
                document.getElementById('profileForm').addEventListener('submit', saveProfile);
            };
            function loadProfile() {
                document.getElementById('fullName').value = userData.fullName;
                document.getElementById('address1').value = userData.address1;
                document.getElementById('address2').value = userData.address2;
                document.getElementById('city').value = userData.city;
                document.getElementById('state').value = userData.state;
                document.getElementById('zipCode').value = userData.zipCode;
                document.getElementById('preferences').value = userData.preferences;
                document.getElementById('availability').value = userData.availability;
                let skillsSelect = document.getElementById('skills');
                for (let option of skillsSelect.options) {
                    if (userData.skills.includes(option.value)) {
                        option.selected = true;
                    }
                }
            }
            function enableEditing() {
                let formElements = document.querySelectorAll('#profileForm input, #profileForm select, #profileForm textarea');
                formElements.forEach(el => el.removeAttribute('readonly'));
                document.getElementById('state').disabled = false;
                document.getElementById('skills').disabled = false;

                document.getElementById('editButton').style.display = 'none';
                document.getElementById('saveButton').style.display = 'inline';
            }
            function saveProfile(event) {
                event.preventDefault();
                userData.fullName = document.getElementById('fullName').value;
                userData.address1 = document.getElementById('address1').value;
                userData.address2 = document.getElementById('address2').value;
                userData.city = document.getElementById('city').value;
                userData.state = document.getElementById('state').value;
                userData.zipCode = document.getElementById('zipCode').value;
                userData.preferences = document.getElementById('preferences').value;
                userData.availability = document.getElementById('availability').value;

                let selectedSkills = [];
                let skillsSelect = document.getElementById('skills');
                for (let option of skillsSelect.selectedOptions) {
                    selectedSkills.push(option.value);
                }
                userData.skills = selectedSkills;

                alert('Profile updated successfully!');

                let formElements = document.querySelectorAll('#profileForm input, #profileForm select, #profileForm textarea');
                formElements.forEach(el => el.setAttribute('readonly', true));
                document.getElementById('state').disabled = true;
                document.getElementById('skills').disabled = true;
                document.getElementById('editButton').style.display = 'inline';
                document.getElementById('saveButton').style.display = 'none';
            }
            render(page);
        }
    },

    // Admin home page (unused for now)
    {
        path: '/admin',
        handler: () => {
            const page = document.createElement('div');
            // ...
            render(page);
        }
    },

    // Admin event list (unused for now)
    {
        path: '/admin/events',
        handler: () => {
            const page = document.createElement('div');
            // ...
            render(page);
        }
    },

    // Admin event management/editor page
    {
        path: '/admin/events/:eventId',
        handler: (params) => {
            const page = document.createElement('div');
            page.innerHTML = /*html*/`
            <h2>Manage Event: ${params.eventId}</h2>
            <form id="eventForm">
                <div class="form-group mb-3">
                    <label for="eventName">Event Name</label>
                    <input type="text" id="eventName" class="form-control" maxlength="100" required>
                </div>
                <div class="form-group mb-3">
                    <label for="eventDescription">Event Description</label>
                    <textarea id="eventDescription" class="form-control" required></textarea>
                </div>
                <div class="form-group mb-3">
                    <label for="eventLocation">Location</label>
                    <textarea id="eventLocation" class="form-control" required></textarea>
                </div>
                <div class="form-group mb-3">
                    <label for="requiredSkills">Required Skills</label>
                    <select id="requiredSkills" class="form-select" multiple required>
                        <option value="first_aid">First Aid</option>
                        <option value="cooking">Cooking</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="transport">Transport</option>
                        <!-- Add more as needed -->
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label for="urgency">Urgency</label>
                    <select id="urgency" class="form-select" required>
                        <option value="">Select urgency</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label for="eventDate">Event Date</label>
                    <input type="date" id="eventDate" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary">Submit</button>
            </form>
        `;

            // Basic client-side validation handler
            const form = page.querySelector('#eventForm');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                alert('Event form submitted successfully!');
            });

            render(page);
        }
    },

    // Admin event volunteer matching page
    {
        path: '/admin/events/:eventId/matching',
        handler: (params) => {
            const page = document.createElement('div');
            const eventId = params.eventId;

            // Mock data for volunteers and events
            const mockVolunteers = [
                { id: 1, name: "John Doe", skills: ["first_aid", "cooking"], location: "Houston, TX", availability: "2025-07-01" },
                { id: 2, name: "Jane Smith", skills: ["cleaning", "transport"], location: "Austin, TX", availability: "2025-07-02" },
            ];
            const mockEvents = [
                { id: "1", name: "Community Cleanup", requiredSkills: ["cleaning"], location: "Houston, TX", date: "2025-07-01" },
                { id: "2", name: "Food Drive", requiredSkills: ["cooking"], location: "Austin, TX", date: "2025-07-02" },
            ];

            // Find the current event
            const currentEvent = mockEvents.find(e => e.id === eventId) || { name: `Event ${eventId}`, requiredSkills: [], location: "", date: "" };

            // Match volunteers based on skills, location, and availability
            const matchedVolunteers = mockVolunteers.filter(v =>
                v.skills.some(skill => currentEvent.requiredSkills.includes(skill)) &&
                v.location === currentEvent.location &&
                v.availability === currentEvent.date
            );

            page.innerHTML = /*html*/`
            <h2>Volunteer Matching for ${currentEvent.name}</h2>
            <form id="volunteerMatchingForm" class="mb-3">
                <div class="form-group mb-3">
                    <label for="volunteerSelect">Select Volunteer</label>
                    <select id="volunteerSelect" class="form-select" required>
                        <option value="">Select a volunteer</option>
                        ${matchedVolunteers.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label for="eventName">Matched Event</label>
                    <input type="text" id="eventName" class="form-control" value="${currentEvent.name}" readonly>
                </div>
                <button type="submit" class="btn btn-primary">Assign Volunteer</button>
            </form>
            <div id="formMessage" style="color: green;"></div>
        `;

            // Form submission handler
            const form = page.querySelector('#volunteerMatchingForm');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const volunteerId = page.querySelector('#volunteerSelect').value;
                if (!volunteerId) {
                    page.querySelector('#formMessage').style.color = 'red';
                    page.querySelector('#formMessage').textContent = 'Please select a volunteer.';
                    return;
                }
                page.querySelector('#formMessage').style.color = 'green';
                page.querySelector('#formMessage').textContent = `Volunteer assigned to ${currentEvent.name} successfully!`;
                setTimeout(() => {
                    navigate('/admin/events');
                }, 1000);
            });

            render(page);
        }
    },

    // Notifications page
    {
        path: '/notifications',
        handler: () => {
            const page = document.createElement('div');
            // ...
            render(page);
        }
    },

    // Activity page displaying event and volunteer activity history
    {
        path: '/activity',
        handler: () => {
            const page = document.createElement('div');
            // ...
            render(page);
        }
    }

];

// Path matcher: supports one :placeholder per path segment
function matchRoute(path) {
    for (const route of routes) {
        const routeParts = route.path.split('/').filter(Boolean);
        const pathParts = path.split('/').filter(Boolean);
        if (routeParts.length !== pathParts.length) continue;

        let params = {};
        let match = true;
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                const key = routeParts[i].slice(1);
                params[key] = pathParts[i];
            } else if (routeParts[i] !== pathParts[i]) {
                match = false;
                break;
            }
        }
        if (match) return { handler: route.handler, params };
    }
    return null;
}

function navigate(path) {
    window.history.pushState({}, '', path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const match = matchRoute(path);
    if (match) match.handler(match.params || {});
}

// Set up listeners
window.addEventListener('popstate', handleRoute);

// On page content load, set up app navigation links
document.addEventListener('DOMContentLoaded', () => {
    handleRoute();
    const anchors = document.querySelectorAll('a');
    for (const anchor of anchors) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//')) {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(href);
            });
        }
    }
});
