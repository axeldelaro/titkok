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

    // TEMPORARY: Reset Button for Debugging
    const resetBtn = document.createElement('button');
    resetBtn.innerText = '⚠️ RESET APP / LOGOUT';
    resetBtn.style.position = 'fixed';
    resetBtn.style.bottom = '10px';
    resetBtn.style.right = '10px';
    resetBtn.style.zIndex = '9999';
    resetBtn.style.background = 'red';
    resetBtn.style.color = 'white';
    resetBtn.style.padding = '10px';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '5px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.onclick = () => {
        if (confirm('Reset app and clear all tokens?')) {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = window.location.origin + window.location.pathname; // Reload without query params
        }
    };
    document.body.appendChild(resetBtn);
});
