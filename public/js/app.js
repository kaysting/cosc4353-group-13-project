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
            render(page);
        }
    },
    // User login form
    {
        path: '/login',
        handler: () => {
            
            const page = document.createElement('div');
            render(page);
        }
    },
    // User profile editor form
    {
        path: '/profile',
        handler: () => {
            const page = document.createElement('div');
            page.innerText = 'Profile editor page';
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
            const eventId = params.eventId;
            page.innerText = `Manage event ${eventId}`;
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
