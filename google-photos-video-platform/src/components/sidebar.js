import Router from '../js/router.js';

export default function Sidebar() {
    const aside = document.createElement('aside');
    aside.className = 'sidebar';

    const menuItems = [
        { icon: '🏠', label: 'Home', path: '#/' },
        { icon: '❤️', label: 'Liked Videos', path: '#/likes' },
        { icon: '📂', label: 'Playlists', path: '#/playlists' }, // Fixed route to plural based on typical conventions, mapped to 'playlist' in router
        { icon: '🕒', label: 'History', path: '#/history' },
    ];

    aside.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${menuItems.map(item => `
                <a href="${item.path}" class="nav-item" style="display: flex; align-items: center; gap: 1rem; padding: 0.8rem; border-radius: 8px; transition: background 0.2s;">
                    <span>${item.icon}</span>
                    <span>${item.label}</span>
                </a>
            `).join('')}
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1rem 0;">
        
        <div style="padding: 0 0.8rem;">
            <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">YOUR PLAYLISTS</h3>
            <div id="sidebar-playlists">
                <!-- Playlists will be injected here -->
                <p style="font-size: 0.8rem; color: #666;">No playlists yet</p>
            </div>
        </div>
        
        <style>
            .nav-item:hover {
                background-color: rgba(255,255,255,0.1);
            }
        </style>
    `;

    return aside;
}
