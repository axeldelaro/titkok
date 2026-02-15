import Store from './store.js';

const DB_NAME = 'cloudstream_gallery';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let _db = null;

function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => {
            _db = req.result;
            resolve(_db);
        };
        req.onerror = () => reject(req.error);
    });
}

function txStore(mode) {
    return openDB().then(db => {
        const tx = db.transaction(STORE_NAME, mode);
        return tx.objectStore(STORE_NAME);
    });
}

const Gallery = {
    init: async () => {
        try {
            const images = await Gallery.getAll();
            Store.set('gallery', images);
        } catch (e) {
            console.error('[Gallery] init failed:', e);
            Store.set('gallery', []);
        }
    },

    addImage: async (imageData) => {
        const store = await txStore('readwrite');
        const entry = {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            blob: imageData.blob,           // actual Blob object (stored in IDB)
            filename: imageData.filename,
            addedAt: new Date().toISOString(),
            width: imageData.width || 0,
            height: imageData.height || 0
        };
        return new Promise((resolve, reject) => {
            const req = store.put(entry);
            req.onsuccess = () => resolve(entry);
            req.onerror = () => reject(req.error);
        });
    },

    addImages: async (files) => {
        const results = [];
        for (const file of files) {
            const dims = await Gallery._getImageDimensions(file);
            const entry = await Gallery.addImage({
                blob: file,
                filename: file.name,
                width: dims.width,
                height: dims.height
            });
            results.push(entry);
        }
        // Update store
        const all = await Gallery.getAll();
        Store.set('gallery', all);
        return results;
    },

    _getImageDimensions: (file) => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
                URL.revokeObjectURL(url);
            };
            img.onerror = () => {
                resolve({ width: 0, height: 0 });
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });
    },

    getAll: async () => {
        const store = await txStore('readonly');
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    getShuffled: async () => {
        const images = await Gallery.getAll();
        // Fisher-Yates shuffle
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        return images;
    },

    getBlobURL: (image) => {
        // Create a temporary blob URL for rendering
        if (image.blob instanceof Blob) {
            return URL.createObjectURL(image.blob);
        }
        // Fallback: if stored as data URL string (legacy)
        if (typeof image.url === 'string') return image.url;
        return '';
    },

    remove: async (imageId) => {
        const store = await txStore('readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(imageId);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    clear: async () => {
        const store = await txStore('readwrite');
        return new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => {
                Store.set('gallery', []);
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    },

    count: async () => {
        const store = await txStore('readonly');
        return new Promise((resolve, reject) => {
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
};

export default Gallery;
