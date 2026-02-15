import Router from '../js/router.js';
import Store from '../js/store.js';

export default function Sidebar() {
    const aside = document.createElement('aside');
    aside.className = 'sidebar';

    const menuItems = [
        { icon: '🏠', label: 'Home', path: '#/' },
        { icon: '❤️', label: 'Liked Videos', path: '#/likes' },
        { icon: '📂', label: 'Playlists', path: '#/playlist' },
        { icon: '🖼️', label: 'Gallery', path: '#/gallery' },
        { icon: '👤', label: 'Profile', path: '#/profile' },
    ];

    aside.innerHTML = `
        <div class="sidebar-nav">
            ${menuItems.map(item => `
                <a href="${item.path}" class="nav-item sidebar-link">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                </a>
            `).join('')}
        </div>
        
        <hr class="sidebar-divider">
        
        <div class="sidebar-section">
            <h3 class="sidebar-section-title">YOUR PLAYLISTS</h3>
            <div id="sidebar-playlists">
                <!-- Playlists will be injected here -->
                <p class="sidebar-empty-text">No playlists yet</p>
            </div>
        </div>
    `;

    // Listen for playlist changes to update sidebar
    Store.addEventListener('stateChange', (e) => {
        if (e.detail.key === 'playlists') {
            updatePlaylists(aside, e.detail.value);
        }
    });

    // Initial load of playlists
    setTimeout(() => {
        const playlists = Store.get('playlists') || [];
        updatePlaylists(aside, playlists);
    }, 100);

    return aside;
}

function updatePlaylists(aside, playlists) {
    const container = aside.querySelector('#sidebar-playlists');
    if (!container) return;

    if (!playlists || playlists.length === 0) {
        container.innerHTML = '<p class="sidebar-empty-text">No playlists yet</p>';
        return;
    }

    container.innerHTML = playlists.map(p => `
        <a href="#/playlist?id=${p.id}" class="nav-item sidebar-playlist-link">
            <span class="nav-icon">📂</span>
            <span class="nav-label">${p.name}</span>
        </a>
    `).join('');
}
