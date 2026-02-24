// Simple Hash Router — expanded with history, stats routes
const routes = {
    '/': 'home',
    '/video': 'video',
    '/mix': 'mix',
    '/likes': 'likes',
    '/playlists': 'playlists',
    '/playlist': 'playlist',
    '/gallery': 'gallery',
    '/profile': 'profile',
    '/search': 'search',
    '/login': 'login',
    '/history': 'history',
    '/stats': 'stats'
};

const Router = {
    init: () => {
        window.addEventListener('hashchange', Router.handleRoute);
        window.addEventListener('load', Router.handleRoute);
    },

    navigate: (path) => {
        window.location.hash = path;
    },

    handleRoute: () => {
        let hash = window.location.hash.slice(1) || '/';
        const [path, query] = hash.split('?');
        const routeName = routes[path] || 'home';
        window.dispatchEvent(new CustomEvent('routeChange', {
            detail: {
                route: routeName,
                path: path,
                params: new URLSearchParams(query)
            }
        }));
    }
};

export default Router;
