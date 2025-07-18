import api from './api.js';

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
            const inputEmail = page.querySelector('#registerEmail');
            const inputPassword = page.querySelector('#registerPassword');
            const btnSubmit = page.querySelector('#registerSubmit');
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
            btnSubmit.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!inputEmail.checkValidity() || !inputPassword.checkValidity()) return;

                const email = inputEmail.value.trim();
                const password = inputPassword.value;

                // Show a message area if not present
                let msg = page.querySelector('#registerMessage');
                if (!msg) {
                    msg = document.createElement('div');
                    msg.id = 'registerMessage';
                    msg.className = 'mt-2';
                    page.appendChild(msg);
                }
                msg.textContent = '';
                msg.style.color = '';

                const data = await api.auth.register(email, password);
                if (data.success === false) {
                    msg.style.color = 'red';
                    msg.textContent = data.message || 'Registration failed.';
                    return;
                }
                msg.style.color = 'green';
                msg.textContent = 'Registration successful! Redirecting to login...';
                setTimeout(() => {
                    navigate('/login');
                }, 1200);
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
                    <div class="form-group mb-3">
                        <label for="loginEmail">Email</label>
                        <input type="email" id="loginEmail" class="form-control" placeholder="Enter your email" required>
                    </div>
                    <div class="form-group mb-3">
                        <label for="loginPassword">Password</label>
                        <input type="password" id="loginPassword" class="form-control" placeholder="Enter your password" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Login</button>
                    <p id="loginMessage" class="mt-2" style="color:red;"></p>
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
                        navigate('/profile');
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
                <div class="container mt-5">
                    <h1 class="mb-4">User Profile</h1>
                    
                    <form id="profileForm">
                        <div class="mb-3">
                            <label for="fullName" class="form-label">Full Name</label>
                            <input type="text" class="form-control" id="fullName" maxlength="50" required readonly>
                        </div>

                        <div class="mb-3">
                            <label for="address1" class="form-label">Address 1</label>
                            <input type="text" class="form-control" id="address1" maxlength="100" required readonly>
                        </div>

                        <div class="mb-3">
                            <label for="address2" class="form-label">Address 2 (Optional)</label>
                            <input type="text" class="form-control" id="address2" maxlength="100" readonly>
                        </div>

                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="city" class="form-label">City</label>
                                <input type="text" class="form-control" id="city" maxlength="100" required readonly>
                            </div>
                            <div class="col-md-3">
                                <label for="state" class="form-label">State</label>
                                <select id="state" class="form-select" required disabled>
                                    <option value="">Select State</option>
                                    <option value="TX">Texas</option>
                                    <option value="FL">Florida</option>
                                    <option value="AZ">Arizona</option>
                                    <option value="CA">California</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label for="zipCode" class="form-label">Zip Code</label>
                                <input type="text" class="form-control" id="zipCode" maxlength="9" pattern=".{5,9}" required readonly>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="skills" class="form-label">Skills</label>
                            <select id="skills" class="form-select" multiple required disabled>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                                <option value="javascript">JSS</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="preferences" class="form-label">Preferences</label>
                            <textarea id="preferences" class="form-control" rows="3" readonly></textarea>
                        </div>

                        <div class="mb-3">
                            <label for="availability" class="form-label">Availability</label>
                            <input type="date" class="form-control" id="availability" required readonly>
                        </div>

                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-primary" id="editButton">Edit</button>
                            <button type="submit" class="btn btn-success" id="saveButton" style="display:none">Save</button>
                        </div>
                    </form>
                </div>
            `;

            //Check if a token exists
            const token = localStorage.getItem('token');
            if (!token) {
                alert("Please log in first.");
                navigateTo('/login');
            }
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
                (async () => {
                    try {
                        const data = await api.profile.get();
                        inputFullName.value = data.fullName || '';
                        inputAddress1.value = data.address1 || '';
                        inputAddress2.value = data.address2 || '';
                        inputCity.value = data.city || '';
                        inputState.value = data.state || '';
                        inputZipCode.value = data.zipCode || '';
                        inputPreferences.value = data.preferences || '';
                        inputAvailability.value = data.availability || '';
                        for (let option of inputSkills.options) {
                            option.selected = data.skills?.includes(option.value);
                        }
                    } catch (error) {
                        console.error('Failed to load profile:', error);
                        alert('Failed to load profile.');
                    }
                })();
            }

            loadProfile();

            function enableEditing() {
                const formElements = form.querySelectorAll('input, select, textarea');
                formElements.forEach(el => el.removeAttribute('readonly'));
                inputState.disabled = false;
                inputSkills.disabled = false;
                btnEdit.style.display = 'none';
                btnSave.style.display = 'inline-block';
            }

            async function saveProfile(event) {
                event.preventDefault();
                //check that Zip code is only 5 digits
                if (!/^\d{5}$/.test(inputZipCode.value)) {
                    alert("Zip code must be exactly 5 digits.");
                    return;
                }
                const updatedProfile = {
                    fullName: inputFullName.value,
                    address1: inputAddress1.value,
                    address2: inputAddress2.value,
                    city: inputCity.value,
                    state: inputState.value,
                    zipCode: inputZipCode.value,
                    preferences: inputPreferences.value,
                    availability: inputAvailability.value,
                    skills: Array.from(inputSkills.selectedOptions).map(option => option.value)
                };
                try {
                    const data = await api.profile.update(updatedProfile);
                    if (data && data.success === false) {
                        alert(data.message || 'Profile update failed');
                        return;
                    }
                    alert('Profile updated successfully!');
                    //Locks the fields again
                    const formElements = form.querySelectorAll('input, select, textarea');
                    formElements.forEach(el => el.setAttribute('readonly', true));
                    inputState.disabled = true;
                    inputSkills.disabled = true;
                    btnEdit.style.display = 'inline-block';
                    btnSave.style.display = 'none';
                } catch (error) {
                    console.error('Failed to update profile:', error);
                    const message = (error && error.message) ? error.message : 'Profile update failed';
                    alert(message);
                }
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
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = {
                    name: document.getElementById('eventName').value.trim(),
                    description: document.getElementById('eventDescription').value.trim(),
                    location: document.getElementById('eventLocation').value.trim(),
                    skills: Array.from(document.getElementById('requiredSkills').selectedOptions).map(opt => opt.value),
                    urgency: document.getElementById('urgency').value,
                    date: document.getElementById('eventDate').value
                };

                const token = localStorage.getItem('token'); // Using 'token' which you're storing manually for now

                if (!token) {
                    alert('Authorization token missing. Please login first.');
                    return;
                }

                try {
                    const data = await api.events.create(formData);
                    if (data && data.success === false) {
                        alert(data.message || 'Error creating event.');
                        return;
                    }
                    alert('Event created successfully!');
                    console.log(data);
                } catch (err) {
                    alert('Error creating event: ' + (err.response?.data?.message || err.message));
                    console.error(err);
                }
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

    {
        path: '/notifications',
        handler: () => {
            const page = document.createElement('div');

            // Updated mock notification data with type and date
            const mockNotifications = [
                { id: 1, message: "You have been assigned to Community Cleanup on 2025-07-01", type: "assignment", date: "2025-06-30" },
                { id: 2, message: "Reminder: Food Drive event tomorrow at 9 AM", type: "reminder", date: "2025-07-01" },
                { id: 3, message: "Event Community Cleanup updated: New location", type: "update", date: "2025-06-29" },
            ];

            page.innerHTML = /*html*/`
            <h2>Notifications</h2>
            <div id="notificationList">
                ${mockNotifications.length === 0 ? '<p>No notifications available.</p>' : ''}
                <ul class="list-group">
                    ${mockNotifications.map(n => /*html*/`
                        <li class="list-group-item">
                            <strong>${n.type ? n.type.charAt(0).toUpperCase() + n.type.slice(1) : 'Notification'}:</strong> ${n.message}
                            <br><small>${n.date || 'No date provided'}</small>
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

for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith('//')) {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            navigate(href);
        });
    }
}