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
                <h2>Register</h2>
                <form>
                    <div class="form-group mb-3">
                        <label for="registerName">Name</label>
                        <input type="text" id="registerName" class="form-control" placeholder="What should we call you?" required>
                        <small class="form-text text-muted">This is the name that volunteering coordinators will see.</small>
                    </div>
                    <div class="form-group mb-3">
                        <label for="registerEmail">Email</label>
                        <input type="email" id="registerEmail" class="form-control" placeholder="Enter your email" required>
                        <small class="form-text text-muted">We'll send volunteering notifications to this address.</small>
                    </div>
                    <div class="form-group mb-3">
                        <label for="registerPassword">Password</label>
                        <input type="password" id="registerPassword" class="form-control" placeholder="Enter your password" required>
                        <small class="form-text text-muted">Your password must be at least 8 characters long.</small>
                    </div>
                    <div class="form-group mb-3">
                        <button id="registerSubmit" type="submit" class="btn btn-primary">Register</button>
                    </div>
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
            const inputFullName = page.querySelector('#fullName');
            const inputAddress1 = page.querySelector('#address1');
            const inputAddress2 = page.querySelector('#address2');
            const inputCity = page.querySelector('#city');
            const inputState = page.querySelector('#state');
            const inputZipCode = page.querySelector('#zipCode');
            const inputSkills = page.querySelector('#skills');
            const inputPreferences = page.querySelector('#preferences');
            const inputAvailability = page.querySelector('#availability');
            const btnEdit = page.querySelector('#editButton');
            const btnSave = page.querySelector('#saveButton');
            const form = page.querySelector('#profileForm');

            function loadProfile() {
                inputFullName.value = userData.fullName;
                inputAddress1.value = userData.address1;
                inputAddress2.value = userData.address2;
                inputCity.value = userData.city;
                inputState.value = userData.state;
                inputZipCode.value = userData.zipCode;
                inputPreferences.value = userData.preferences;
                inputAvailability.value = userData.availability;
                for (let option of inputSkills.options) {
                    option.selected = userData.skills.includes(option.value);
                }
            }
            loadProfile();

            function enableEditing() {
                const formElements = form.querySelectorAll('input, select, textarea');
                formElements.forEach(el => el.removeAttribute('readonly'));
                inputState.disabled = false;
                inputSkills.disabled = false;
                btnEdit.style.display = 'none';
                btnSave.style.display = 'inline';
            }

            function saveProfile(event) {
                event.preventDefault();
                userData.fullName = inputFullName.value;
                userData.address1 = inputAddress1.value;
                userData.address2 = inputAddress2.value;
                userData.city = inputCity.value;
                userData.state = inputState.value;
                userData.zipCode = inputZipCode.value;
                userData.preferences = inputPreferences.value;
                userData.availability = inputAvailability.value;

                userData.skills = Array.from(inputSkills.selectedOptions).map(option => option.value);

                alert('Profile updated successfully!');

                const formElements = form.querySelectorAll('input, select, textarea');
                formElements.forEach(el => el.setAttribute('readonly', true));
                inputState.disabled = true;
                inputSkills.disabled = true;
                btnEdit.style.display = 'inline';
                btnSave.style.display = 'none';
            }

            btnEdit.addEventListener('click', enableEditing);
            form.addEventListener('submit', saveProfile);
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
                    <small class="form-text text-muted">Hold Ctrl (Windows) or Command (Mac) to select multiple skills.</small>
                    <select id="requiredSkills" class="form-select mb-2" multiple required size="4">
                        <option value="bilingual">Bilingual</option>
                        <option value="carpentry">Carpentry</option>
                        <option value="cooking">Cooking</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="digital_marketing">Digital Marketing</option>
                        <option value="first_aid">First Aid</option>
                        <option value="physical_trainer">Physical Trainer</option>
                        <option value="transport">Transport</option>
                        <!-- Add more -->
                    </select>

                    <div class="input-group mb-2">
                        <input type="text" id="newSkill" class="form-control" placeholder="Add a new skill">
                        <button type="button" class="btn btn-outline-secondary" id="addSkillBtn">Add Skill</button>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm" id="removeSkillBtn">Remove Selected Skill(s)</button>
                </div>

                <div class="form-group mb-3">
                    <label for="urgency">Urgency</label>
                    <select id="urgency" class="form-select" required>
                        <option value="" disabled selected hidden>Select urgency</option>
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

            // Allow dynamic skill addition
            const addSkillBtn = page.querySelector('#addSkillBtn');
            const newSkillInput = page.querySelector('#newSkill');
            const skillsSelect = page.querySelector('#requiredSkills');

            addSkillBtn.addEventListener('click', () => {
                const newSkill = newSkillInput.value.trim();
                if (!newSkill) return;

                const normalized = newSkill.toLowerCase();

                // Check for duplicates (case-insensitive)
                const existingOptions = Array.from(skillsSelect.options);
                const isDuplicate = existingOptions.some(opt => opt.textContent.toLowerCase() === normalized);
                if (isDuplicate) {
                    alert(`"${newSkill}" is already in the skill list.`);
                    return;
                }

                // Add new option
                const option = document.createElement('option');
                option.value = normalized.replace(/\s+/g, '_'); // e.g., "first aid" -> "first_aid"
                option.textContent = newSkill;
                option.selected = true;
                skillsSelect.appendChild(option);

                // Sort options alphabetically
                const allOptions = Array.from(skillsSelect.options);
                allOptions.sort((a, b) => a.textContent.localeCompare(b.textContent));
                skillsSelect.innerHTML = '';
                allOptions.forEach(opt => skillsSelect.appendChild(opt));

                // Clear input
                newSkillInput.value = '';

                // Confirmation popup
                alert(`"${newSkill}" has been successfully added to the skill list.`);
            });

            const removeSkillBtn = page.querySelector('#removeSkillBtn');
            removeSkillBtn.addEventListener('click', () => {
                const selectedOptions = Array.from(skillsSelect.selectedOptions);

                if (selectedOptions.length === 0) {
                    alert('Please select at least one skill to remove.');
                    return;
                }

                const confirmDelete = confirm(`Are you sure you want to remove the selected skill(s)?`);
                if (!confirmDelete) return;

                selectedOptions.forEach(opt => opt.remove());
            });
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

            // Mock notification data
            const mockNotifications = [
                { id: 1, message: "hello" },
                { id: 2, message: "hey" },
                { id: 3, message: "hi" },
            ];

            page.innerHTML = /*html*/`
            <h2>Notifications</h2>
            <div id="notificationList">
                ${mockNotifications.length === 0 ? '<p>No notifications available.</p>' : ''}
                <ul class="list-group">
                    ${mockNotifications.map(n => /*html*/`
                        <li class="list-group-item">
                            <strong>${n.type.charAt(0).toUpperCase() + n.type.slice(1)}:</strong> ${n.message}
                            <br><small>${n.date}</small>
                            <button class="btn btn-sm btn-danger float-end dismiss-btn" data-id="${n.id}">Dismiss</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;

            // Add dismiss button functionality
            page.querySelectorAll('.dismiss-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const id = button.getAttribute('data-id');
                    button.parentElement.remove();
                    // Update mockNotifications (in a real app, this would update a database)
                    const updatedNotifications = mockNotifications.filter(n => n.id !== parseInt(id));
                    // Note: Update mockNotifications in a real app
                    if (page.querySelectorAll('.list-group-item').length === 0) {
                        page.querySelector('#notificationList').innerHTML = '<p>No notifications available.</p>';
                    }
                });
            });

            render(page);
        }
    },

    // Activity page displaying event and volunteer activity history
    {
        path: '/activity',
        handler: () => {
            const page = document.createElement('div');

            // Mock volunteer history data
            const mockHistory = [
                {
                    eventId: "1",
                    eventName: "Community Cleanup",
                    description: "City-wide cleanup initiative",
                    location: "Houston, TX",
                    requiredSkills: ["cleaning"],
                    urgency: "Medium",
                    date: "2025-07-01",
                    status: "Completed"
                },
                {
                    eventId: "2",
                    eventName: "Food Drive",
                    description: "Distribute food to local shelters",
                    location: "Austin, TX",
                    requiredSkills: ["cooking"],
                    urgency: "High",
                    date: "2025-07-02",
                    status: "Pending"
                },
            ];

            page.innerHTML = /*html*/`
            <h2>Volunteer History</h2>
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Event Name</th>
                        <th>Description</th>
                        <th>Location</th>
                        <th>Required Skills</th>
                        <th>Urgency</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${mockHistory.map(h => /*html*/`
                        <tr>
                            <td>${h.eventName}</td>
                            <td>${h.description}</td>
                            <td>${h.location}</td>
                            <td>${h.requiredSkills.join(', ')}</td>
                            <td>${h.urgency}</td>
                            <td>${h.date}</td>
                            <td>${h.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

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
