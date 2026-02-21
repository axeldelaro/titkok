import './css/main.css';
import './css/layout.css';
import './css/responsive.css';
import './css/animations.css';
import Router from './js/router.js';
import UI from './js/ui.js';
import Auth from './js/auth.js';

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Check for Auth Callback
    if (window.location.search.includes('code=')) {
        const success = await Auth.handleCallback();
        if (success) {
            console.log('Login successful');
        } else {
            console.error('Login failed');
        }
    }

    UI.init();
    Router.init();

    // Trigger initial route
    Router.handleRoute();

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { });
    }
});
