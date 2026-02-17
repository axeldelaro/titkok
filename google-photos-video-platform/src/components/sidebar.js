import Router from '../js/router.js';

export default function Sidebar() {
    const aside = document.createElement('aside');
    aside.className = 'sidebar';

    const menuItems = [
        { icon: '🏠', label: 'Home', path: '#/' },
        { icon: '❤️', label: 'Liked Videos', path: '#/likes' },
        { icon: '🔀', label: 'Mix', path: '#/mix' },
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
    `;

    return aside;
}
