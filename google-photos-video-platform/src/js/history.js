import Storage from './storage.js';
import Store from './store.js';

const STORAGE_KEY = 'watch_history';
const MAX_HISTORY = 100;

const History = {
    init: () => {
        const history = Storage.get(STORAGE_KEY) || [];
        Store.set('history', history);
    },

    addToHistory: (video) => {
        let history = Storage.get(STORAGE_KEY) || [];

        // Remove duplicate if already in history
        history = history.filter(v => v.id !== video.id);

        // Add to the beginning with timestamp
        history.unshift({
            ...video,
            watchedAt: new Date().toISOString()
        });

        // Limit to MAX_HISTORY entries
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        Storage.set(STORAGE_KEY, history);
        Store.set('history', history);
    },

    getHistory: () => {
        return Storage.get(STORAGE_KEY) || [];
    },

    clearHistory: () => {
        Storage.set(STORAGE_KEY, []);
        Store.set('history', []);
    },

    removeFromHistory: (videoId) => {
        let history = Storage.get(STORAGE_KEY) || [];
        history = history.filter(v => v.id !== videoId);
        Storage.set(STORAGE_KEY, history);
        Store.set('history', history);
    }
};

export default History;
