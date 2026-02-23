// Sidebar — nav visibility controlled by Settings (localStorage key: navVisible)
import Router from '../js/router.js';
import VisualEditor from '../js/visual-editor.js';

// All available nav items
export const ALL_NAV_ITEMS = [
    { key: 'home', icon: '🏠', label: 'Home', path: '#/' },
    { key: 'history', icon: '🕐', label: 'History', path: '#/history' },
    { key: 'likes', icon: '❤️', label: 'Liked Videos', path: '#/likes' },
    { key: 'mix', icon: '🔀', label: 'Mix', path: '#/mix' },
    { key: 'gallery', icon: '🖼️', label: 'Gallery', path: '#/gallery' },
    { key: 'visual', icon: '🎨', label: 'Visual Editor', path: '#/visual-editor' },
    { key: 'stats', icon: '📊', label: 'Stats', path: '#/stats' },
    { key: 'profile', icon: '👤', label: 'Profile', path: '#/profile' },
];

const NAV_VISIBLE_KEY = 'navVisibleItems';

export function getVisibleItems() {
    try {
        const saved = JSON.parse(localStorage.getItem(NAV_VISIBLE_KEY));
        if (Array.isArray(saved) && saved.length > 0) {
            return ALL_NAV_ITEMS.filter(item => saved.includes(item.key));
        }
    } catch { }
    // Default: all visible
    return ALL_NAV_ITEMS;
}

export function setVisibleItems(keys) {
    // Always keep profile visible so user can get back to settings
    const safe = [...new Set([...keys, 'home', 'profile'])];
    localStorage.setItem(NAV_VISIBLE_KEY, JSON.stringify(safe));
    // Broadcast so existing sidebar instances can re-render
    window.dispatchEvent(new Event('navVisibilityChange'));
}

export default function Sidebar() {
    const aside = document.createElement('aside');
    aside.className = 'sidebar';

    const render = () => {
        const visibleItems = getVisibleItems();
        const currentHash = window.location.hash || '#/';

        aside.innerHTML = `
            <div class="sidebar-nav">
                ${visibleItems.map(item => `
                    <a href="${item.path}" class="nav-item sidebar-link ${currentHash === item.path ? 'sidebar-link-active' : ''}">
                        <span class="nav-icon">${item.icon}</span>
                        <span class="nav-label">${item.label}</span>
                    </a>
                `).join('')}
            </div>
        `;

        // Intercept Visual Editor link
        const veLink = aside.querySelector('a[href="#/visual-editor"]');
        if (veLink) {
            veLink.addEventListener('click', (e) => {
                e.preventDefault();
                VisualEditor.init();
                VisualEditor.toggle();
            });
        }
    };

    render();

    // Re-render on nav visibility change
    window.addEventListener('navVisibilityChange', render);

    // Update active link on route change
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#/';
        aside.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.toggle('sidebar-link-active', link.getAttribute('href') === hash);
        });
    });

    return aside;
}
