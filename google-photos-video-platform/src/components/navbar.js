import Auth from '../js/auth.js';
import Router from '../js/router.js';
import Store from '../js/store.js';

export default function Navbar() {
    const nav = document.createElement('nav');
    nav.className = 'header';

    const isAuth = Auth.isAuthenticated();
    const user = Store.get('user'); // If we fetched user info

    nav.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <button id="menu-toggle" aria-label="Toggle Menu" style="font-size: 1.5rem;">☰</button>
            <a href="#/" style="font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="color: var(--primary-color);">▶</span> CloudStream
            </a>
        </div>
        
        <div style="flex: 1; max-width: 600px; margin: 0 1rem;">
            <div style="display: flex; background: rgba(255,255,255,0.1); border-radius: 99px; padding: 0.5rem 1rem;">
                <input type="text" id="search-input" placeholder="Search videos..." 
                    style="background: transparent; border: none; color: white; width: 100%; outline: none;">
                <button aria-label="Search">🔍</button>
            </div>
        </div>

        <div style="display: flex; align-items: center; gap: 1rem;">
            ${isAuth
            ? `<button id="upload-btn" class="btn-primary" style="display:flex;align-items:center;gap:0.5rem;">
                     <span>📹</span> Upload
                   </button>`
            : ''}
            <button id="theme-toggle" aria-label="Toggle Theme" style="font-size: 1.2rem;">🌙</button>
            ${isAuth
            ? `<button id="logout-btn" class="btn-secondary">Logout</button>`
            : `<button id="login-btn" class="btn-primary">Sign In</button>`
        }
        </div>
    `;

    // Event Listeners
    setTimeout(() => {
        const toggleBtn = nav.querySelector('#menu-toggle');
        const themeBtn = nav.querySelector('#theme-toggle');
        const loginBtn = nav.querySelector('#login-btn');
        const logoutBtn = nav.querySelector('#logout-btn');
        const uploadBtn = nav.querySelector('#upload-btn');
        const searchInput = nav.querySelector('#search-input');

        if (toggleBtn) {
            toggleBtn.onclick = () => {
                document.dispatchEvent(new CustomEvent('toggleSidebar'));
            };
        }

        if (themeBtn) {
            themeBtn.onclick = () => {
                const isDark = document.body.style.getPropertyValue('--bg-color') !== '#ffffff';
                if (isDark) {
                    document.body.style.setProperty('--bg-color', '#ffffff');
                    document.body.style.setProperty('--text-color', '#0f0f0f');
                    document.body.style.setProperty('--surface-color', '#f0f0f0');
                    themeBtn.textContent = '☀️';
                } else {
                    document.body.style.removeProperty('--bg-color');
                    document.body.style.removeProperty('--text-color');
                    document.body.style.removeProperty('--surface-color');
                    themeBtn.textContent = '🌙';
                }
            };
        }

        if (uploadBtn) {
            uploadBtn.onclick = () => {
                document.dispatchEvent(new CustomEvent('triggerUpload'));
            };
        }

        if (loginBtn) {
            loginBtn.onclick = () => Auth.login();
        }

        if (logoutBtn) {
            logoutBtn.onclick = () => Auth.logout();
        }

        if (searchInput) {
            searchInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        window.location.hash = `/search?q=${encodeURIComponent(query)}`;
                    }
                }
            };
        }
    }, 0);

    return nav;
}
