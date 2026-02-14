// Simple Hash Router

const routes = {
    '/': 'home',
    '/video': 'video',
    '/playlist': 'playlist',
    '/likes': 'likes',
    '/history': 'history',
    '/profile': 'profile',
    '/login': 'login'
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
        // Handle params like /video?id=123
        const [path, query] = hash.split('?');

        const routeName = routes[path] || 'home';

        // Dispatch event for UI to update
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
