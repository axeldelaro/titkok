// Navbar with Avatar (#33), Notification bell (#41), Theme customizer link
import Auth from '../js/auth.js';
import Router from '../js/router.js';
import Store from '../js/store.js';

export default function Navbar() {
    const nav = document.createElement('nav');
    nav.className = 'header';

    const isAuth = Auth.isAuthenticated();
    const user = Store.get('user');

    nav.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <button id="menu-toggle" aria-label="Toggle Menu" style="font-size: 1.5rem;">☰</button>
            <a href="#/" style="font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="color: var(--primary-color);">▶</span> CloudStream
            </a>
        </div>
        
        <div style="flex: 1; max-width: 600px; margin: 0 1rem;">
            <div class="search-bar-wrapper">
                <span class="search-icon">🔍</span>
                <input type="text" id="search-input" placeholder="Search videos..." class="search-input">
                <kbd class="search-kbd">/</kbd>
            </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
            ${isAuth
            ? `<button id="upload-btn" class="nav-action-btn" title="Upload">
                       <span>📹</span>
                   </button>`
            : ''}
            <button id="notif-btn" class="nav-action-btn" title="Notifications" style="position:relative;">
                🔔
                <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
            </button>
            <button id="shortcuts-btn" class="nav-action-btn" title="Keyboard Shortcuts (?)" style="font-size:0.9rem;">
                ⌨️
            </button>
            <button id="theme-toggle" class="nav-action-btn" title="Toggle Theme">🌙</button>
            ${isAuth && user && user.picture
            ? `<a href="#/profile" class="nav-avatar-link">
                       <img src="${user.picture}" alt="${user.name || 'User'}" referrerpolicy="no-referrer" class="nav-avatar">
                   </a>`
            : isAuth
                ? `<a href="#/profile" class="nav-avatar-link">
                           <div class="nav-avatar-placeholder">${(user?.name || 'U').charAt(0).toUpperCase()}</div>
                       </a>`
                : `<button id="login-btn" class="btn-primary">Sign In</button>`
        }
        </div>
    `;

    // Event Listeners
    setTimeout(() => {
        const toggleBtn = nav.querySelector('#menu-toggle');
        const themeBtn = nav.querySelector('#theme-toggle');
        const loginBtn = nav.querySelector('#login-btn');
        const uploadBtn = nav.querySelector('#upload-btn');
        const searchInput = nav.querySelector('#search-input');
        const shortcutsBtn = nav.querySelector('#shortcuts-btn');
        const notifBtn = nav.querySelector('#notif-btn');

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
                    document.body.style.setProperty('--surface-hover', '#e0e0e0');
                    document.body.style.setProperty('--border-color', '#ddd');
                    themeBtn.textContent = '☀️';
                } else {
                    document.body.style.removeProperty('--bg-color');
                    document.body.style.removeProperty('--text-color');
                    document.body.style.removeProperty('--surface-color');
                    document.body.style.removeProperty('--surface-hover');
                    document.body.style.removeProperty('--border-color');
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

        if (searchInput) {
            searchInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        window.location.hash = `/search?q=${encodeURIComponent(query)}`;
                    }
                }
            };
            // Feature: "/" shortcut to focus search
            document.addEventListener('keydown', (e) => {
                if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    searchInput.focus();
                }
            });
        }

        // Feature #35: Keyboard Shortcuts modal
        if (shortcutsBtn) {
            shortcutsBtn.onclick = () => {
                let modal = document.getElementById('shortcuts-modal');
                if (modal) { modal.remove(); return; }
                modal = document.createElement('div');
                modal.id = 'shortcuts-modal';
                modal.className = 'modal-overlay open';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width:500px;">
                        <div class="modal-header">
                            <h2>⌨️ Keyboard Shortcuts</h2>
                            <button class="close-btn">×</button>
                        </div>
                        <div class="modal-body" style="max-height:60vh;overflow-y:auto;">
                            <div class="shortcut-grid">
                                ${[
                        ['Space / K', 'Play / Pause'],
                        ['F', 'Fullscreen'],
                        ['M', 'Mute / Unmute'],
                        ['L', 'Toggle Loop'],
                        ['V', 'Cycle Video Filter'],
                        ['C', 'Cinema Mode'],
                        ['Z', 'Cycle Zoom'],
                        ['D', 'Download Video'],
                        ['J', 'Rewind 10s'],
                        [';', 'Forward 10s'],
                        ['← →', 'Seek ±5s'],
                        ['↑ ↓', 'Volume ±10%'],
                        ['/', 'Focus Search'],
                        ['?', 'Show Shortcuts'],
                        ['Esc', 'Close Modal'],
                    ].map(([key, desc]) => `
                                    <div class="shortcut-row">
                                        <kbd class="shortcut-key">${key}</kbd>
                                        <span>${desc}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                modal.querySelector('.close-btn').onclick = () => modal.remove();
                modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                document.body.appendChild(modal);
            };

            // "?" key opens shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.key === '?' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    shortcutsBtn.click();
                }
            });
        }

        // Feature #41: Notification Center
        if (notifBtn) {
            notifBtn.onclick = () => {
                let panel = document.getElementById('notif-panel');
                if (panel) { panel.remove(); return; }
                const notifs = JSON.parse(localStorage.getItem('notifications') || '[]');
                panel = document.createElement('div');
                panel.id = 'notif-panel';
                panel.className = 'notif-panel';
                panel.innerHTML = `
                    <div class="notif-header">
                        <strong>Notifications</strong>
                        <button id="clear-notifs" style="font-size:0.8rem;color:var(--text-secondary);">Clear all</button>
                    </div>
                    <div class="notif-list">
                        ${notifs.length === 0
                        ? '<div style="padding:20px;text-align:center;color:var(--text-secondary);">No notifications</div>'
                        : notifs.map(n => `
                                <div class="notif-item">
                                    <span class="notif-icon">${n.icon || 'ℹ️'}</span>
                                    <div>
                                        <div style="font-size:0.9rem;">${n.message}</div>
                                        <div style="font-size:0.75rem;color:var(--text-secondary);">${new Date(n.time).toLocaleString()}</div>
                                    </div>
                                </div>
                            `).join('')}
                    </div>
                `;
                panel.querySelector('#clear-notifs').onclick = () => {
                    localStorage.setItem('notifications', '[]');
                    const badge = nav.querySelector('#notif-badge');
                    if (badge) badge.style.display = 'none';
                    panel.remove();
                };
                // Close on click outside
                setTimeout(() => {
                    document.addEventListener('click', function handler(e) {
                        if (!panel.contains(e.target) && e.target !== notifBtn) {
                            panel.remove();
                            document.removeEventListener('click', handler);
                        }
                    });
                }, 0);
                notifBtn.parentElement.appendChild(panel);
            };
        }
    }, 0);

    return nav;
}

// Helper to push a notification
export function pushNotification(message, icon = 'ℹ️') {
    const notifs = JSON.parse(localStorage.getItem('notifications') || '[]');
    notifs.unshift({ message, icon, time: Date.now() });
    if (notifs.length > 50) notifs.splice(50);
    localStorage.setItem('notifications', JSON.stringify(notifs));
    // Update badge
    const badge = document.querySelector('#notif-badge');
    if (badge) {
        badge.textContent = notifs.length;
        badge.style.display = 'flex';
    }
}
