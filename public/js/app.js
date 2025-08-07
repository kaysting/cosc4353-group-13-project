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
                        <label for="registerRepeatPassword">Repeat Password</label>
                        <input type="password" id="registerRepeatPassword" class="form-control" placeholder="Repeat your password" required>
                        <small class="form-text text-muted">Please re-enter your password.</small>
                    </div>
                    <div class="form-group mb-3">
                        <button id="registerSubmit" type="submit" class="btn btn-primary">Register</button>
                    </div>
                    <div id="registerError" class="text-danger mt-2" style="display:none"></div>
                </form>
            `;
            const inputEmail = page.querySelector('#registerEmail');
            const inputPassword = page.querySelector('#registerPassword');
            const inputRepeatPassword = page.querySelector('#registerRepeatPassword');
            const btnSubmit = page.querySelector('#registerSubmit');
            const errorDiv = page.querySelector('#registerError');
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
                // Also check repeat password
                if (inputRepeatPassword.value && inputRepeatPassword.value !== inputPassword.value) {
                    inputRepeatPassword.setCustomValidity('Passwords do not match');
                } else {
                    inputRepeatPassword.setCustomValidity('');
                }
            });
            // Repeat password must match password
            inputRepeatPassword.addEventListener('input', () => {
                if (inputRepeatPassword.value !== inputPassword.value) {
                    inputRepeatPassword.setCustomValidity('Passwords do not match');
                } else {
                    inputRepeatPassword.setCustomValidity('');
                }
            });
            // Handle submit
            btnSubmit.addEventListener('click', async (e) => {
                e.preventDefault();
                errorDiv.style.display = 'none';
                errorDiv.textContent = '';
                if (!inputEmail.checkValidity()) {
                    errorDiv.textContent = inputEmail.validationMessage;
                    errorDiv.style.display = 'block';
                    return;
                }
                if (!inputPassword.checkValidity()) {
                    errorDiv.textContent = inputPassword.validationMessage;
                    errorDiv.style.display = 'block';
                    return;
                }
                if (!inputRepeatPassword.checkValidity()) {
                    errorDiv.textContent = inputRepeatPassword.validationMessage;
                    errorDiv.style.display = 'block';
                    return;
                }
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
                setTimeout(async () => {
                    // Update nav for logged out state
                    updateNavLinks(null);
                    navigate('/login');
                }, 1000);
            });
            render(page);
        }
    },

    // Email verification form
    {
        path: '/register/verify',
        handler: () => {
            const page = document.createElement('div');
            // Get userId and email from query params
            const url = new URL(window.location.href);
            const userId = url.searchParams.get('userId') || '';
            const email = url.searchParams.get('email') || '';
            page.innerHTML = /*html*/`
                <h2>Verify Your Email</h2>
                <p>A verification code has been sent to: <strong>${email}</strong></p>
                <form id="verifyEmailForm">
                    <div class="form-group mb-3">
                        <label for="verificationCode">Verification Code</label>
                        <input type="text" id="verificationCode" class="form-control" placeholder="Enter the code sent to your email" maxlength="6" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Verify</button>
                    <p id="verificationMessage" class="mt-2" style="color:red;"></p>
                </form>
            `;
            const inputCode = page.querySelector('#verificationCode');
            const verificationMessage = page.querySelector('#verificationMessage');
            // submit event listener to the verification form
            page.querySelector('#verifyEmailForm').addEventListener('submit', async function (e) {
                e.preventDefault();
                const code = inputCode.value.trim();
                verificationMessage.textContent = '';
                verificationMessage.style.color = '';
                if (!userId || !email) {
                    verificationMessage.textContent = 'Missing user information. Please use the verification link from your email.';
                    verificationMessage.style.color = 'red';
                    return;
                }
                // Call API for email verification
                const data = await api.auth.verifyEmail(userId, email, code);
                if (data.success) {
                    verificationMessage.style.color = 'green';
                    verificationMessage.textContent = 'Email verified! Redirecting to your profile...';
                    setTimeout(async () => {
                        // Reload user info and update nav
                        let userInfo = null;
                        try {
                            userInfo = await api.auth.getCurrentUser();
                        } catch (e) {
                            userInfo = null;
                        }
                        updateNavLinks(userInfo);
                        navigate('/profile');
                    }, 1000);
                } else {
                    verificationMessage.style.color = 'red';
                    verificationMessage.textContent = data.message || 'Verification failed.';
                }
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
            const inputEmail = page.querySelector('#loginEmail');
            const inputPassword = page.querySelector('#loginPassword');
            const loginMessage = page.querySelector('#loginMessage');
            // submit event listener to the login form
            page.querySelector('#loginForm').addEventListener('submit', async function (e) {
                e.preventDefault();
                const email = inputEmail.value.trim();
                const password = inputPassword.value;
                const message = loginMessage;
                loginMessage.textContent = '';
                message.style.color = '';
                // Call API for login
                const data = await api.auth.login(email, password);
                if (data.success) {
                    updateNavLinks(data.user);
                    if (data.is_email_verified) {
                        message.style.color = 'green';
                        message.textContent = 'Login successful! Redirecting...';
                        setTimeout(() => {
                            navigate('/profile');
                        }, 1000);
                    } else {
                        message.style.color = 'orange';
                        message.textContent = 'Email not verified. Redirecting to verification...';
                        setTimeout(() => {
                            navigate(`/register/verify?userId=${encodeURIComponent(data.user.id)}&email=${encodeURIComponent(data.user.email)}`);
                        }, 1000);
                    }
                } else {
                    message.style.color = 'red';
                    message.textContent = data.message;
                }
            });
            render(page);
        }
    },

    // User profile editor form
    {
        path: '/profile',
        handler: async () => {
            // Removed email verification check before rendering profile
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
                                    <option value="AL">Alabama</option>
                                    <option value="AK">Alaska</option>
                                    <option value="AZ">Arizona</option>
                                    <option value="AR">Arkansas</option>
                                    <option value="CA">California</option>
                                    <option value="CO">Colorado</option>
                                    <option value="CT">Connecticut</option>
                                    <option value="DE">Delaware</option>
                                    <option value="FL">Florida</option>
                                    <option value="GA">Georgia</option>
                                    <option value="HI">Hawaii</option>
                                    <option value="ID">Idaho</option>
                                    <option value="IL">Illinois</option>
                                    <option value="IN">Indiana</option>
                                    <option value="IA">Iowa</option>
                                    <option value="KS">Kansas</option>
                                    <option value="KY">Kentucky</option>
                                    <option value="LA">Louisiana</option>
                                    <option value="ME">Maine</option>
                                    <option value="MD">Maryland</option>
                                    <option value="MA">Massachusetts</option>
                                    <option value="MI">Michigan</option>
                                    <option value="MN">Minnesota</option>
                                    <option value="MS">Mississippi</option>
                                    <option value="MO">Missouri</option>
                                    <option value="MT">Montana</option>
                                    <option value="NE">Nebraska</option>
                                    <option value="NV">Nevada</option>
                                    <option value="NH">New Hampshire</option>
                                    <option value="NJ">New Jersey</option>
                                    <option value="NM">New Mexico</option>
                                    <option value="NY">New York</option>
                                    <option value="NC">North Carolina</option>
                                    <option value="ND">North Dakota</option>
                                    <option value="OH">Ohio</option>
                                    <option value="OK">Oklahoma</option>
                                    <option value="OR">Oregon</option>
                                    <option value="PA">Pennsylvania</option>
                                    <option value="RI">Rhode Island</option>
                                    <option value="SC">South Carolina</option>
                                    <option value="SD">South Dakota</option>
                                    <option value="TN">Tennessee</option>
                                    <option value="TX">Texas</option>
                                    <option value="UT">Utah</option>
                                    <option value="VT">Vermont</option>
                                    <option value="VA">Virginia</option>
                                    <option value="WA">Washington</option>
                                    <option value="WV">West Virginia</option>
                                    <option value="WI">Wisconsin</option>
                                    <option value="WY">Wyoming</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label for="zipCode" class="form-label">Zip Code</label>
                                <input type="text" class="form-control" id="zipCode" maxlength="9" pattern=".{5,9}" required readonly>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="skills" class="form-label">Skills</label>
                            <select id="skills" class="form-select" multiple required disabled></select>
                        </div>

                        <div class="mb-3">
                            <label for="preferences" class="form-label">Preferences</label>
                            <textarea id="preferences" class="form-control" rows="3" readonly></textarea>
                        </div>

                        <div class="mb-3">
                            <div class="row-g2">
                                <div class="col">
                                    <label for="availabilityStart" class="form-label">Available From</label>
                                    <input type="date" class="form-control" id="availabilityStart" required readonly>
                                </div>
                                <div class="col">
                                    <label for="availabilityEnd" class="form-label">Available To</label>
                                    <input type="date" class="form-control" id="availabilityEnd" required readonly>
                                </div>
                            </div>
                        </div>

                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-primary" id="editButton">Edit</button>
                            <button type="submit" class="btn btn-success" id="saveButton" style="display:none">Save</button>
                        </div>
                    </form>
                </div>
            `;

            // Check if a token exists
            const token = localStorage.getItem('token');
            if (!token) {
                alert("Please log in first.");
                return navigate('/login');
            }
            const inputFullName = page.querySelector('#fullName');
            const inputAddress1 = page.querySelector('#address1');
            const inputAddress2 = page.querySelector('#address2');
            const inputCity = page.querySelector('#city');
            const inputState = page.querySelector('#state');
            const inputZipCode = page.querySelector('#zipCode');
            const inputSkills = page.querySelector('#skills');
            const inputPreferences = page.querySelector('#preferences');
            const inputAvailabilityStart = page.querySelector('#availabilityStart');
            const inputAvailabilityEnd = page.querySelector('#availabilityEnd');
            const btnEdit = page.querySelector('#editButton');
            const btnSave = page.querySelector('#saveButton');
            const form = page.querySelector('#profileForm');

            function loadProfile() {
                (async () => {
                    try {
                        const data = await api.profile.get();

                        // Fetch all available skills from backend
                        const skillsResponse = await api.skills.getAll();
                        if (skillsResponse.success) {
                            inputSkills.innerHTML = ''; // Clear any previous entries

                            skillsResponse.skills.forEach(skill => {
                                const normalized = skill.label.toLowerCase().replace(/\s+/g, '_');
                                const option = document.createElement('option');
                                option.value = normalized;
                                option.textContent = skill.label;
                                option.selected = data.skills?.includes(normalized);
                                inputSkills.appendChild(option);
                            });
                        }
                        
                        inputFullName.value = data.fullName || '';
                        inputAddress1.value = data.address1 || '';
                        inputAddress2.value = data.address2 || '';
                        inputCity.value = data.city || '';
                        inputState.value = data.state || '';
                        inputZipCode.value = data.zipCode || '';
                        inputPreferences.value = data.preferences || '';
                        inputAvailabilityStart.value = data.availabilityStart || '';
                        inputAvailabilityEnd.value = data.availabilityEnd || '';
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
                    alert("Zip Code must be 5 digits.");
                    return;
                }
                //Date range check
                const startDate = new Date(inputAvailabilityStart.value);
                const endDate = new Date(inputAvailabilityEnd.value);
                if (startDate > endDate) {
                    alert("Available To date cannot be earlier than Available From date!");
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
                    availabilityStart: inputAvailabilityStart.value,
                    availabilityEnd: inputAvailabilityEnd.value,
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

    /*// Admin home page (unused for now)
    {
        path: '/admin',
        handler: () => {
            const page = document.createElement('div');
            // ...
            render(page);
        }
    }, */


    // Admin event creation page
    {
        path: '/admin/events/create',
        handler: async () => {

            const currentUser = await api.auth.getCurrentUser();
            if (!currentUser || !currentUser.is_admin) {
                const page = document.createElement('div');
                page.innerHTML = `<h2>Create Event</h2><p class="text-danger">Access denied. Admins only.</p>`;
                render(page);
                return;
            }

            const page = document.createElement('div');
            page.innerHTML = /*html*/`
            <h2>Create Event</h2>
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

            const skillsSelect = page.querySelector('#requiredSkills');
            const loadSkills = async () => {
                const result = await api.skills.getAll();
                if (result.success) {
                    skillsSelect.innerHTML = '';
                    result.skills.forEach(skill => {
                        const option = document.createElement('option');
                        option.value = skill.label.toLowerCase().replace(/\s+/g, '_');
                        option.textContent = skill.label;
                        skillsSelect.appendChild(option);
                    });
                }
            };
            await loadSkills();

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
            //const skillsSelect = page.querySelector('#requiredSkills');

           addSkillBtn.addEventListener('click', async () => {
                const newSkill = newSkillInput.value.trim();
                if (!newSkill) return;

                const existingLabels = Array.from(skillsSelect.options).map(o => o.textContent.toLowerCase());
                if (existingLabels.includes(newSkill.toLowerCase())) {
                    alert(`"${newSkill}" already exists.`);
                    return;
                }

                const result = await api.skills.add(newSkill);
                if (!result.success) {
                    alert(result.message || 'Failed to add skill');
                    return;
                }

                await loadSkills(); // refresh skill list
                newSkillInput.value = '';
                alert(`"${newSkill}" has been added!`);
            });

            const removeSkillBtn = page.querySelector('#removeSkillBtn');
            removeSkillBtn.addEventListener('click', async () => {
                const selectedOptions = Array.from(skillsSelect.selectedOptions);
                if (selectedOptions.length === 0) {
                    alert('Please select at least one skill to remove.');
                    return;
                }
                if (!confirm('Are you sure you want to remove selected skill(s)?')) return;

                for (const option of selectedOptions) {
                    const label = option.textContent;
                    await api.skills.remove(label);
                }

                await loadSkills(); // refresh after deletion
            });
        }
    },

    // Admin event management/editor page
    {
        path: '/admin/events/:eventId',
        handler: (params) => {
            renderEventForm('edit', params.eventId);
        }
    },


    // Admin: List all events to edit
    {
        path: '/admin/events',
        handler: async () => {
            const page = document.createElement('div');
            page.innerHTML = `<h2>All Events</h2><div id="eventList"></div>`;

            const eventListDiv = page.querySelector('#eventList');
            const response = await api.events.getAll();

            if (!response.success) {
                eventListDiv.innerHTML = `<p class="text-danger">Error loading events: ${response.message}</p>`;
            } else if (response.events.length === 0) {
                eventListDiv.innerHTML = `<p>No events found.</p>`;
            } else {
                const list = document.createElement('ul');
                list.className = 'list-group';

                response.events.forEach(event => {
                    const item = document.createElement('li');
                    item.className = 'list-group-item d-flex justify-content-between align-items-center';
                    item.textContent = `${event.name} (${event.date})`;

                    // Edit link
                    const editLink = document.createElement('a');
                    editLink.href = `/admin/events/${event.id}`;
                    editLink.textContent = 'Edit';
                    editLink.className = 'btn btn-sm btn-primary';

                    // Delete button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.className = 'btn btn-sm btn-danger ms-2';
                    deleteBtn.addEventListener('click', async () => {
                        if (confirm(`Are you sure you want to delete "${event.name}"?`)) {
                            const response = await api.events.delete(event.id);
                            if (response.success) {
                                alert('Event deleted successfully!');
                                navigate('/admin/events'); // Refresh list
                            } else {
                                alert('Error deleting event: ' + response.message);
                            }
                        }
                    });

                    const buttonGroup = document.createElement('div');
                    buttonGroup.appendChild(editLink);
                    buttonGroup.appendChild(deleteBtn);

                    item.appendChild(buttonGroup);
                    list.appendChild(item);
                });

                eventListDiv.appendChild(list);
            }

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
    },

    {
        path: '/admin/reports',
        handler: async () => {
            // Check admin access
            const currentUser = await api.auth.getCurrentUser();
            if (!currentUser || !currentUser.is_admin) {
                const page = document.createElement('div');
                page.innerHTML = `
                    <div class="container mt-4">
                        <h2>Reports</h2>
                        <div class="alert alert-danger">Access denied. Admin privileges required.</div>
                    </div>
                `;
                render(page);
                return;
            }

            const page = document.createElement('div');
            page.innerHTML = /*html*/`
                <div class="container mt-4">
                    <h2>📊 Generate Reports</h2>
                    <p class="text-muted">Generate comprehensive reports on volunteer activities and event management.</p>
                    
                    <div class="row mt-4">
                        <!-- Volunteer Report Card -->
                        <div class="col-md-6 mb-4">
                            <div class="card h-100 shadow-sm">
                                <div class="card-header bg-primary text-white">
                                    <h5 class="mb-0">👥 Volunteer Report</h5>
                                </div>
                                <div class="card-body">
                                    <p class="card-text">Generate a comprehensive report of all volunteers including:</p>
                                    <ul class="small">
                                        <li>Personal information and contact details</li>
                                        <li>Skills and preferences</li>
                                        <li>Availability schedule</li>
                                        <li>Complete participation history</li>
                                        <li>Total events participated</li>
                                    </ul>
                                    <div class="d-grid gap-2">
                                        <div class="btn-group" role="group">
                                            <button class="btn btn-outline-danger" id="volunteerPdfBtn">
                                                📄 Download PDF
                                            </button>
                                            <button class="btn btn-outline-success" id="volunteerCsvBtn">
                                                📊 Download CSV
                                            </button>
                                            <button class="btn btn-outline-info" id="volunteerJsonBtn">
                                                💻 View JSON
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Event Report Card -->
                        <div class="col-md-6 mb-4">
                            <div class="card h-100 shadow-sm">
                                <div class="card-header bg-success text-white">
                                    <h5 class="mb-0">📅 Event Report</h5>
                                </div>
                                <div class="card-body">
                                    <p class="card-text">Generate a detailed report of all events including:</p>
                                    <ul class="small">
                                        <li>Event details and descriptions</li>
                                        <li>Location and date information</li>
                                        <li>Required skills and urgency level</li>
                                        <li>Assigned volunteers list</li>
                                        <li>Event status (Upcoming/Past)</li>
                                    </ul>
                                    <div class="d-grid gap-2">
                                        <div class="btn-group" role="group">
                                            <button class="btn btn-outline-danger" id="eventPdfBtn">
                                                📄 Download PDF
                                            </button>
                                            <button class="btn btn-outline-success" id="eventCsvBtn">
                                                📊 Download CSV
                                            </button>
                                            <button class="btn btn-outline-info" id="eventJsonBtn">
                                                💻 View JSON
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Results Section -->
                    <div id="reportResults" class="mt-4" style="display:none;">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Report Preview</h5>
                            </div>
                            <div class="card-body">
                                <div id="reportContent" style="max-height: 500px; overflow-y: auto;">
                                    <!-- JSON results will appear here -->
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Loading Spinner -->
                    <div id="loadingSpinner" class="text-center mt-4" style="display:none;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Generating report...</span>
                        </div>
                        <p class="mt-2">Generating report, please wait...</p>
                    </div>
                </div>
            `;

            // Helper function to download report with auth token
            const downloadReport = async (type, format) => {
                const token = localStorage.getItem('token');
                const loadingDiv = document.getElementById('loadingSpinner');
                const resultsDiv = document.getElementById('reportResults');

                loadingDiv.style.display = 'block';
                resultsDiv.style.display = 'none';

                try {
                    const response = await fetch(`/api/reports/${type}?format=${format}`, {
                        headers: {
                            'Authorization': token
                        }
                    });

                    if (format === 'json') {
                        const data = await response.json();
                        loadingDiv.style.display = 'none';

                        // Display JSON in the results section
                        resultsDiv.style.display = 'block';
                        document.getElementById('reportContent').innerHTML = `
                            <pre class="mb-0">${JSON.stringify(data, null, 2)}</pre>
                        `;
                    } else {
                        // For PDF and CSV, create a download link
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `${type}_report.${format}`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        loadingDiv.style.display = 'none';

                        // Show success message
                        alert(`✅ ${type} report has been downloaded as ${format.toUpperCase()}.`);
                    }
                } catch (error) {
                    loadingDiv.style.display = 'none';
                    console.error('Report generation error:', error);
                    alert('❌ Failed to generate report. Please try again.');
                }
            };

            // Attach event listeners to buttons
            page.querySelector('#volunteerPdfBtn').addEventListener('click', () => downloadReport('volunteers', 'pdf'));
            page.querySelector('#volunteerCsvBtn').addEventListener('click', () => downloadReport('volunteers', 'csv'));
            page.querySelector('#volunteerJsonBtn').addEventListener('click', () => downloadReport('volunteers', 'json'));

            page.querySelector('#eventPdfBtn').addEventListener('click', () => downloadReport('events', 'pdf'));
            page.querySelector('#eventCsvBtn').addEventListener('click', () => downloadReport('events', 'csv'));
            page.querySelector('#eventJsonBtn').addEventListener('click', () => downloadReport('events', 'json'));

            render(page);
        }
    }

];

{
    path: '/admin/volunteer-matching',
    handler: async () => {
        // Check admin access
        const currentUser = await api.auth.getCurrentUser();
        if (!currentUser || !currentUser.is_admin) {
            const page = document.createElement('div');
            page.innerHTML = `
                <div class="container mt-4">
                    <h2>Volunteer Matching</h2>
                    <div class="alert alert-danger">Access denied. Admin privileges required.</div>
                </div>
            `;
            render(page);
            return;
        }

        const page = document.createElement('div');
        page.innerHTML = `
            <div class="container mt-4">
                <h2>🎯 Volunteer Matching System</h2>
                <p class="text-muted">Match and assign volunteers to events based on skills, location, and availability</p>

                <!-- Event Selection -->
                <div class="card mb-4">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">📅 Select Event</h5>
                    </div>
                    <div class="card-body">
                        <select id="eventSelect" class="form-select">
                            <option value="">-- Select an event --</option>
                        </select>
                    </div>
                </div>

                <!-- Event Details -->
                <div id="eventDetails" class="card mb-4" style="display:none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div class="card-body">
                        <h5 class="card-title" id="eventName"></h5>
                        <p class="card-text" id="eventDescription"></p>
                        <div class="row">
                            <div class="col-md-4">
                                <strong>📍 Location:</strong> <span id="eventLocation"></span>
                            </div>
                            <div class="col-md-4">
                                <strong>📆 Date:</strong> <span id="eventDate"></span>
                            </div>
                            <div class="col-md-4">
                                <strong>⚡ Urgency:</strong> <span id="eventUrgency" class="badge bg-warning text-dark"></span>
                            </div>
                        </div>
                        <div class="mt-3">
                            <strong>🔧 Required Skills:</strong>
                            <div id="eventSkills"></div>
                        </div>
                    </div>
                </div>

                <!-- Matching Results -->
                <div id="matchingSection" style="display:none;">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0">✅ Matching Volunteers</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <button id="findMatchesBtn" class="btn btn-primary">🔍 Find Matching Volunteers</button>
                                <button id="assignSelectedBtn" class="btn btn-success ms-2" style="display:none;">✔️ Assign Selected</button>
                                <button id="selectAllBtn" class="btn btn-outline-secondary ms-2" style="display:none;">Select All</button>
                                <button id="deselectAllBtn" class="btn btn-outline-secondary ms-2" style="display:none;">Deselect All</button>
                            </div>
                            
                            <div id="matchResults" class="row"></div>
                            
                            <div id="noMatches" class="alert alert-warning" style="display:none;">
                                No matching volunteers found for this event. The volunteers may not have the required skills, be available on the event date, or be in the right location.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Already Assigned Volunteers -->
                <div id="assignedSection" class="card mt-4" style="display:none;">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">👥 Already Assigned Volunteers</h5>
                    </div>
                    <div class="card-body">
                        <div id="assignedList"></div>
                    </div>
                </div>
            </div>
        `;

        render(page);

        // Load all events
        const loadEvents = async () => {
            const token = localStorage.getItem('token');
            const response = await api.events.getAll();
            
            const eventSelect = document.getElementById('eventSelect');
            eventSelect.innerHTML = '<option value="">-- Select an event --</option>';
            
            if (response.success && response.events) {
                response.events.forEach(event => {
                    const option = document.createElement('option');
                    option.value = event.id;
                    option.textContent = `${event.name} - ${new Date(event.date).toLocaleDateString()}`;
                    eventSelect.appendChild(option);
                });
            }
        };

        await loadEvents();

        let selectedEvent = null;
        let matchingVolunteers = [];
        let selectedVolunteers = new Set();

        // Event selection handler
        document.getElementById('eventSelect').addEventListener('change', async (e) => {
            const eventId = e.target.value;
            
            if (!eventId) {
                document.getElementById('eventDetails').style.display = 'none';
                document.getElementById('matchingSection').style.display = 'none';
                document.getElementById('assignedSection').style.display = 'none';
                return;
            }

            // Get event details
            const token = localStorage.getItem('token');
            const eventResponse = await api.events.get(eventId);
            
            if (eventResponse.success && eventResponse.event) {
                selectedEvent = eventResponse.event;
                
                // Display event details
                document.getElementById('eventName').textContent = selectedEvent.name;
                document.getElementById('eventDescription').textContent = selectedEvent.description;
                document.getElementById('eventLocation').textContent = selectedEvent.location;
                document.getElementById('eventDate').textContent = new Date(selectedEvent.date).toLocaleDateString();
                document.getElementById('eventUrgency').textContent = selectedEvent.urgency.toUpperCase();
                
                // Display required skills
                const skillsContainer = document.getElementById('eventSkills');
                skillsContainer.innerHTML = '';
                if (selectedEvent.skills && selectedEvent.skills.length > 0) {
                    selectedEvent.skills.forEach(skill => {
                        const badge = document.createElement('span');
                        badge.className = 'badge bg-primary me-2';
                        badge.textContent = skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        skillsContainer.appendChild(badge);
                    });
                } else {
                    skillsContainer.innerHTML = '<span class="text-white-50">No specific skills required</span>';
                }
                
                document.getElementById('eventDetails').style.display = 'block';
                document.getElementById('matchingSection').style.display = 'block';
                
                // Reset matching results
                document.getElementById('matchResults').innerHTML = '';
                document.getElementById('noMatches').style.display = 'none';
                document.getElementById('assignSelectedBtn').style.display = 'none';
                document.getElementById('selectAllBtn').style.display = 'none';
                document.getElementById('deselectAllBtn').style.display = 'none';
                selectedVolunteers.clear();
            }
        });

        // Find matches handler
        document.getElementById('findMatchesBtn').addEventListener('click', async () => {
            if (!selectedEvent) return;
            
            const token = localStorage.getItem('token');
            const response = await api.events.matchCheck(selectedEvent.id);
            
            const matchResults = document.getElementById('matchResults');
            matchResults.innerHTML = '';
            
            if (response.success && response.volunteers && response.volunteers.length > 0) {
                matchingVolunteers = response.volunteers;
                document.getElementById('noMatches').style.display = 'none';
                document.getElementById('assignSelectedBtn').style.display = 'inline-block';
                document.getElementById('selectAllBtn').style.display = 'inline-block';
                document.getElementById('deselectAllBtn').style.display = 'inline-block';
                
                matchingVolunteers.forEach(volunteer => {
                    const col = document.createElement('div');
                    col.className = 'col-md-6 mb-3';
                    
                    const card = document.createElement('div');
                    card.className = 'card volunteer-card';
                    card.dataset.volunteerId = volunteer.userId;
                    
                    // Calculate match score
                    const matchedSkills = selectedEvent.skills ? 
                        volunteer.skills.filter(skill => selectedEvent.skills.includes(skill)) : [];
                    const matchScore = selectedEvent.skills ? 
                        Math.round((matchedSkills.length / selectedEvent.skills.length) * 100) : 100;
                    
                    card.innerHTML = `
                        <div class="card-body">
                            <div class="form-check mb-2">
                                <input class="form-check-input volunteer-checkbox" type="checkbox" value="${volunteer.userId}" id="vol_${volunteer.userId}">
                                <label class="form-check-label" for="vol_${volunteer.userId}">
                                <h6 class="mb-1">${volunteer.name}</h6>
                                </label>
                            </div>
                            <p class="text-muted small mb-2">${volunteer.email}</p>
                            <p class="mb-2">📍 ${volunteer.location}</p>
                            <div class="mb-2">
                                <strong>Skills:</strong><br>
                                ${volunteer.skills.map(skill => {
                                    const isMatched = matchedSkills.includes(skill);
                                    const skillName = skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    return `<span class="badge ${isMatched ? 'bg-success' : 'bg-secondary'} me-1">${skillName}</span>`;
                                }).join('') || '<span class="text-muted">No skills listed</span>'}
                            </div>
                            <div class="text-end">
                                <span class="match-score">Match Score: ${matchScore}%</span>
                            </div>
                        </div>
                    `;
                    
                    col.appendChild(card);
                    matchResults.appendChild(col);
                    
                    // Add click handler for card selection
                    card.addEventListener('click', (e) => {
                        if (e.target.type !== 'checkbox') {
                            const checkbox = card.querySelector('.volunteer-checkbox');
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    });
                    
                    // Add change handler for checkbox
                    card.querySelector('.volunteer-checkbox').addEventListener('change', (e) => {
                        if (e.target.checked) {
                            selectedVolunteers.add(volunteer.userId);
                            card.classList.add('selected');
                        } else {
                            selectedVolunteers.delete(volunteer.userId);
                            card.classList.remove('selected');
                        }
                    });
                });
            } else {
                document.getElementById('noMatches').style.display = 'block';
                document.getElementById('assignSelectedBtn').style.display = 'none';
                document.getElementById('selectAllBtn').style.display = 'none';
                document.getElementById('deselectAllBtn').style.display = 'none';
            }
        });

        // Select all handler
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            document.querySelectorAll('.volunteer-checkbox').forEach(checkbox => {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change'));
            });
        });

        // Deselect all handler
        document.getElementById('deselectAllBtn').addEventListener('click', () => {
            document.querySelectorAll('.volunteer-checkbox').forEach(checkbox => {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            });
        });

        // Assign selected volunteers
        document.getElementById('assignSelectedBtn').addEventListener('click', async () => {
            if (selectedVolunteers.size === 0) {
                alert('Please select at least one volunteer to assign.');
                return;
            }
            
            if (!confirm(`Are you sure you want to assign ${selectedVolunteers.size} volunteer(s) to this event?`)) {
                return;
            }
            
            const token = localStorage.getItem('token');
            let successCount = 0;
            let failCount = 0;
            
            for (const volunteerId of selectedVolunteers) {
                const response = await api.events.matchAssign(selectedEvent.id, volunteerId);
                if (response.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.error(`Failed to assign volunteer ${volunteerId}:`, response.message);
                }
            }
            
            if (successCount > 0) {
                alert(`✅ Successfully assigned ${successCount} volunteer(s)!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
                
                // Refresh the matching results
                document.getElementById('findMatchesBtn').click();
            } else {
                alert(`❌ Failed to assign volunteers. Please try again.`);
            }
        });
    }
}

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


// Navigation visibility logic
function updateNavLinks(userInfo) {
    // Helper to show/hide by id
    function show(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    }
    function hide(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    // Default: hide all
    hide('nav-login');
    hide('nav-register');
    hide('nav-profile');
    hide('nav-admin-create');
    hide('nav-admin-edit');
    hide('nav-notifications');
    hide('nav-history');
    hide('nav-admin-reports');
    hide('nav-logout');

    if (!userInfo || !userInfo.email) {
        // Not logged in
        show('nav-login');
        show('nav-register');
    } else {
        // Logged in
        show('nav-profile');
        show('nav-notifications');
        show('nav-history');
        show('nav-logout');
        if (userInfo.is_admin) {
            show('nav-admin-create');
            show('nav-admin-edit');
            show('nav-admin-reports');
        }
    }
}

// Set up listeners
window.addEventListener('popstate', handleRoute);

// On page content load, set up app navigation links
document.addEventListener('DOMContentLoaded', async () => {
    handleRoute();

    // Get user info (if logged in)
    let userInfo = null;
    try {
        userInfo = await api.auth.getCurrentUser();
    } catch (e) {
        userInfo = null;
    }
    updateNavLinks(userInfo);

    // Logout button logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            // Remove token and call API logout if available
            localStorage.removeItem('token');
            if (api.auth.logout) {
                try { await api.auth.logout(); } catch (e) { }
            }
            // Reset nav and redirect
            updateNavLinks(null);
            navigate('/login');
        };
    }

    // Set up SPA navigation for anchors
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

async function renderEventForm(mode, eventId = null) {
    const page = document.createElement('div');
    const title = mode === 'edit' ? 'Edit Event' : 'Create Event';
    page.innerHTML = `<h2>${title}</h2><form id="eventForm">Loading...</form>`;
    render(page);

    const form = page.querySelector('#eventForm');

    let eventData = {
        id: eventId,
        name: '',
        description: '',
        location: '',
        skills: [],
        urgency: '',
        date: ''
    };

    // Fetch event data if editing
    if (mode === 'edit') {
        const response = await api.events.get(eventId);
        if (!response.success) {
            form.innerHTML = `<p class="text-danger">${response.message}</p>`;
            return;
        }
        eventData = response.event;

        if (eventData.date) {
            const d = new Date(eventData.date);
            eventData.date = d.toISOString().split('T')[0];
        }
    }

    // Set up form structure with an empty skill select (to populate after)
    form.innerHTML = `
        <div class="form-group mb-3">
            <label>Event Name</label>
            <input type="text" id="eventName" class="form-control" value="${eventData.name}" required>
        </div>
        <div class="form-group mb-3">
            <label>Description</label>
            <textarea id="eventDescription" class="form-control" required>${eventData.description}</textarea>
        </div>
        <div class="form-group mb-3">
            <label>Location</label>
            <textarea id="eventLocation" class="form-control" required>${eventData.location}</textarea>
        </div>
        <div class="form-group mb-3">
            <label>Required Skills</label>
            <select id="requiredSkills" class="form-select mb-2" multiple size="6">
                <!-- Skills will be loaded here -->
            </select>
        </div>
        <div class="form-group mb-3">
            <label>Urgency</label>
            <select id="urgency" class="form-select" required>
                <option value="" disabled ${!eventData.urgency ? 'selected' : ''}>Select urgency</option>
                <option value="low" ${eventData.urgency === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${eventData.urgency === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${eventData.urgency === 'high' ? 'selected' : ''}>High</option>
            </select>
        </div>
        <div class="form-group mb-3">
            <label>Date</label>
            <input type="date" id="eventDate" class="form-control" value="${eventData.date}" required>
        </div>
        <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Update' : 'Create'} Event</button>
    `;

    // 🌟 Dynamically load skills from DB and pre-select
    const skillsSelect = form.querySelector('#requiredSkills');

    const loadSkills = async () => {
        const result = await api.skills.getAll();
        if (result.success) {
            skillsSelect.innerHTML = '';
            result.skills.forEach(skill => {
                const option = document.createElement('option');
                const normalized = skill.label.toLowerCase().replace(/\s+/g, '_');
                option.value = normalized;
                option.textContent = skill.label;

                // Pre-select if this skill is in the eventData
                if (eventData.skills.includes(normalized)) {
                    option.selected = true;
                }

                skillsSelect.appendChild(option);
            });
        } else {
            skillsSelect.innerHTML = `<option disabled>Error loading skills</option>`;
        }
    };

    await loadSkills();

    // Form submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            id: eventId,
            name: form.eventName.value.trim(),
            description: form.eventDescription.value.trim(),
            location: form.eventLocation.value.trim(),
            skills: Array.from(form.requiredSkills.selectedOptions).map(o => o.value),
            urgency: form.urgency.value,
            date: form.eventDate.value
        };

        console.log("Submitting event update:", payload); // Debug line

        const result = mode === 'edit'
            ? await api.events.update(payload)
            : await api.events.create(payload);

        if (result.success) {
            alert(`${mode === 'edit' ? 'Updated' : 'Created'} successfully!`);
            navigate('/admin/events');
        } else {
            alert('Error: ' + result.message);
        }
    });
}


// Handle all internal link clicks using the client-side router
document.body.addEventListener('click', (e) => {
    if (
        e.target.tagName === 'A' &&
        e.target.href.startsWith(location.origin)
    ) {
        e.preventDefault();
        const path = new URL(e.target.href).pathname;
        navigate(path);
    }
});
