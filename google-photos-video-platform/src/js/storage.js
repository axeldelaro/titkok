// Storage wrapper for safe local/session storage usage

const Storage = {
    get: (key, type = 'local') => {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            const item = storage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error(`Error getting key ${key} from ${type}Storage`, e);
            return null;
        }
    },

    set: (key, value, type = 'local') => {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error setting key ${key} to ${type}Storage`, e);
            return false;
        }
    },

    remove: (key, type = 'local') => {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.removeItem(key);
        } catch (e) {
            console.error(`Error removing key ${key} from ${type}Storage`, e);
        }
    },

    clear: (type = 'local') => {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.clear();
        } catch (e) {
            console.error(`Error clearing ${type}Storage`, e);
        }
    }
};

export default Storage;
