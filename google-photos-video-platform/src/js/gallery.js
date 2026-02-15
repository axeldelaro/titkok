import Storage from './storage.js';
import Store from './store.js';

const STORAGE_KEY = 'gallery_images';

const Gallery = {
    init: () => {
        const images = Storage.get(STORAGE_KEY) || [];
        Store.set('gallery', images);
    },

    addImage: (imageData) => {
        const images = Storage.get(STORAGE_KEY) || [];
        images.unshift({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            url: imageData.url,         // blob URL or base64
            filename: imageData.filename,
            addedAt: new Date().toISOString(),
            width: imageData.width || 0,
            height: imageData.height || 0
        });
        Storage.set(STORAGE_KEY, images);
        Store.set('gallery', images);
        return images[0];
    },

    addImages: (files) => {
        return new Promise((resolve) => {
            const results = [];
            let processed = 0;

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // Get dimensions
                    const img = new Image();
                    img.onload = () => {
                        const imageData = Gallery.addImage({
                            url: e.target.result, // base64 data URL (persists across sessions)
                            filename: file.name,
                            width: img.naturalWidth,
                            height: img.naturalHeight
                        });
                        results.push(imageData);
                        processed++;
                        if (processed === files.length) resolve(results);
                    };
                    img.onerror = () => {
                        processed++;
                        if (processed === files.length) resolve(results);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        });
    },

    getAll: () => {
        return Storage.get(STORAGE_KEY) || [];
    },

    getShuffled: () => {
        const images = Gallery.getAll();
        // Fisher-Yates shuffle
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        return images;
    },

    remove: (imageId) => {
        let images = Storage.get(STORAGE_KEY) || [];
        images = images.filter(img => img.id !== imageId);
        Storage.set(STORAGE_KEY, images);
        Store.set('gallery', images);
    },

    clear: () => {
        Storage.set(STORAGE_KEY, []);
        Store.set('gallery', []);
    }
};

export default Gallery;
