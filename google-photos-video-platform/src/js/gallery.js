import API from './api.js';
import Store from './store.js';

const Gallery = {
    _images: [],
    _loading: false,
    _loaded: false,

    init: async () => {
        // Start loading in background — don't block UI init
        Gallery.fetchAllImages().catch(e => {
            console.error('[Gallery] init failed:', e);
        });
    },

    // Fetch ALL images from Google Photos (loops through all pages)
    fetchAllImages: async () => {
        if (Gallery._loading) return;
        Gallery._loading = true;

        try {
            let allImages = [];
            let pageToken = null;

            do {
                const data = await API.searchImages(pageToken, 100);
                const items = (data && data.mediaItems) || [];
                allImages = [...allImages, ...items];
                pageToken = data?.nextPageToken || null;

                // Update store progressively so UI can show images as they load
                Gallery._images = allImages;
                Store.set('gallery', Gallery._images);
            } while (pageToken);

            Gallery._loaded = true;
            console.log(`[Gallery] Loaded ${allImages.length} images from Google Photos`);
        } catch (e) {
            console.error('[Gallery] fetchAllImages error:', e);
        } finally {
            Gallery._loading = false;
        }
    },

    isLoaded: () => Gallery._loaded,
    isLoading: () => Gallery._loading,

    getAll: () => {
        return Gallery._images;
    },

    getShuffled: () => {
        const images = [...Gallery._images];
        // Fisher-Yates shuffle
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        return images;
    },

    // Upload multiple image files with per-file progress callbacks
    uploadImages: async (files, { onFileStart, onFileProgress, onFileComplete, onFileError } = {}) => {
        const results = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (onFileStart) onFileStart(file, i, files.length);

            try {
                const mediaItem = await API.uploadMedia(file, (percent) => {
                    if (onFileProgress) onFileProgress(file, i, files.length, percent);
                });
                if (mediaItem) {
                    results.push(mediaItem);
                    // Add to local images immediately so it shows up
                    Gallery._images.unshift(mediaItem);
                    Store.set('gallery', Gallery._images);
                }
                if (onFileComplete) onFileComplete(file, i, files.length, mediaItem);
            } catch (e) {
                console.error(`[Gallery] Failed to upload ${file.name}:`, e);
                if (onFileError) onFileError(file, i, files.length, e);
            }
        }

        return results;
    },

    // Add local blob images for instant preview (before upload completes)
    addLocalImages: (files) => {
        const localImages = files.map(file => ({
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            filename: file.name,
            baseUrl: URL.createObjectURL(file),
            _isLocal: true,
            mediaMetadata: {
                creationTime: new Date().toISOString(),
                photo: {}
            }
        }));

        Gallery._images = [...localImages, ...Gallery._images];
        Store.set('gallery', Gallery._images);
        return localImages;
    },

    // Remove local placeholder images (after upload is done)
    removeLocalImages: () => {
        Gallery._images = Gallery._images.filter(img => !img._isLocal);
        Store.set('gallery', Gallery._images);
    },

    // Get image URL for display (Google Photos baseUrl with dimension suffix)
    getImageURL: (image, width = 1080) => {
        if (!image || !image.baseUrl) return '';
        // Local blob URLs don't need suffixes
        if (image._isLocal) return image.baseUrl;
        return `${image.baseUrl}=w${width}`;
    },

    // Get full-resolution URL
    getFullURL: (image) => {
        if (!image || !image.baseUrl) return '';
        if (image._isLocal) return image.baseUrl;
        const meta = image.mediaMetadata || {};
        const w = meta.width || 4096;
        const h = meta.height || 4096;
        return `${image.baseUrl}=w${w}-h${h}`;
    },

    count: () => {
        return Gallery._images.length;
    }
};

export default Gallery;
