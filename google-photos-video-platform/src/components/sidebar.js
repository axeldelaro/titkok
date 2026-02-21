// Sidebar with Active Link (#30), History link, and Playlists (#39)
import Router from '../js/router.js';
import VisualEditor from '../js/visual-editor.js';

export default function Sidebar() {
    const aside = document.createElement('aside');
    aside.className = 'sidebar';

    const menuItems = [
        { icon: '🏠', label: 'Home', path: '#/' },
        { icon: '🕐', label: 'History', path: '#/history' },
        { icon: '❤️', label: 'Liked Videos', path: '#/likes' },
        { icon: '🔀', label: 'Mix', path: '#/mix' },
        { icon: '🖼️', label: 'Gallery', path: '#/gallery' },
        { icon: '🎨', label: 'Visual Editor', path: '#/visual-editor' },
        { icon: '📊', label: 'Stats', path: '#/stats' },
        { icon: '👤', label: 'Profile', path: '#/profile' },
    ];

    const currentHash = window.location.hash || '#/';

    aside.innerHTML = `
        <div class="sidebar-nav">
            ${menuItems.map(item => `
                <a href="${item.path}" class="nav-item sidebar-link ${currentHash === item.path ? 'sidebar-link-active' : ''}">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                </a>
            `).join('')}
        </div>
    `;

    // Intercept Visual Editor link — toggle panel instead of routing
    const veLink = aside.querySelector('a[href="#/visual-editor"]');
    if (veLink) {
        veLink.addEventListener('click', (e) => {
            e.preventDefault();
            VisualEditor.init();
            VisualEditor.toggle();
        });
    }

    // Update active link on route change
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#/';
        aside.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.toggle('sidebar-link-active', link.getAttribute('href') === hash);
        });
    });

    return aside;
}
