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
                </form>
            `;
            // TODO: Add validation and submission
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
                        window.location.hash = '#/profile';
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
                <h2>User Profile</h2><br>
                <form action="/submit-form" method "POST">
                    <!--To get the user's name-->
                    <label for="name">Name (required, 50 characters max):</label><br>
                    <input type="text" id="name" maxlength="50" required><br><br>
                    <!--To get the user's Primary Address-->
                    <label for="address1">Address 1 (required, 100 characters max):</label><br>
                    <input type="text" id="address1" maxlength="100" required><br><br>
                    <!--To get the user's Secondary Address-->
                    <label for="address2">Address 2 (optional, 100 characters max):</label><br>
                    <input type="text" id="address2" maxlength="100"><br><br>
                    <!--City-->
                    <label for="city">City (required, 100 characters max)</label><br>
                    <input type="text" id="city" maxlength="100" required><br><br>
                    <!--State-->
                    <label for="state">State (required)</label><br>
                    <select name="state" id="state" required>
                        <option value="">Select a State</option>  
                        <option value="AL">AL</option>
                        <!-- Insert every state here-->  
                    </select><br><br>
                    <!-- Unfinished-->
                <button type="submit">Submit</button>
                </form>
            `
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
            page.innerText = `Find volunteers for event ${eventId}`;
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
