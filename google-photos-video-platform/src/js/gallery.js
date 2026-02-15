import API from './api.js';
import Store from './store.js';

const Gallery = {
    _images: [],
    _nextPageToken: null,
    _loading: false,

    init: async () => {
        // Load the first page of images from Google Photos
        try {
            await Gallery.fetchImages();
        } catch (e) {
            console.error('[Gallery] init failed:', e);
            Store.set('gallery', []);
        }
    },

    fetchImages: async (pageToken = null) => {
        if (Gallery._loading) return;
        Gallery._loading = true;

        try {
            const data = await API.searchImages(pageToken, 100);
            const newItems = (data && data.mediaItems) || [];

            if (pageToken) {
                // Append to existing
                Gallery._images = [...Gallery._images, ...newItems];
            } else {
                // First load / refresh
                Gallery._images = newItems;
            }

            Gallery._nextPageToken = data?.nextPageToken || null;
            Store.set('gallery', Gallery._images);
        } catch (e) {
            console.error('[Gallery] fetchImages error:', e);
        } finally {
            Gallery._loading = false;
        }
    },

    // Load next page for infinite scroll
    fetchMore: async () => {
        if (!Gallery._nextPageToken || Gallery._loading) return false;
        await Gallery.fetchImages(Gallery._nextPageToken);
        return true;
    },

    hasMore: () => !!Gallery._nextPageToken,

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

    // Upload a single image file to Google Photos
    uploadImage: async (file, onProgress) => {
        return API.uploadMedia(file, onProgress);
    },

    // Upload multiple image files
    uploadImages: async (files, onProgress) => {
        const results = [];
        for (let i = 0; i < files.length; i++) {
            try {
                const mediaItem = await API.uploadMedia(files[i], (percent) => {
                    if (onProgress) {
                        // Report overall progress across all files
                        const overall = ((i / files.length) + (percent / 100 / files.length)) * 100;
                        onProgress(overall);
                    }
                });
                if (mediaItem) results.push(mediaItem);
            } catch (e) {
                console.error(`[Gallery] Failed to upload ${files[i].name}:`, e);
            }
        }

        // Refresh the gallery after uploads
        if (results.length > 0) {
            await Gallery.fetchImages();
        }

        return results;
    },

    // Get image URL for display (Google Photos baseUrl with dimension suffix)
    getImageURL: (image, width = 1080) => {
        if (!image || !image.baseUrl) return '';
        return `${image.baseUrl}=w${width}`;
    },

    // Get full-resolution URL
    getFullURL: (image) => {
        if (!image || !image.baseUrl) return '';
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
