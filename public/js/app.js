const elPageContainer = document.getElementById('page');

function render(elPageContent) {
    elPageContainer.innerHTML = '';
    elPageContainer.appendChild(elPageContent);
}

const routes = [
    {
        path: '/login',
        handler: () => {
            const page = document.createElement('div');
            page.innerText = 'Log in page';
            render(page);
        }
    },
    {
        path: '/profile',
        handler: () => {
            const page = document.createElement('div');
            page.innerText = 'Profile editor page';
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