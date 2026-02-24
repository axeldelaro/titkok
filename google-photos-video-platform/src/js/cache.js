/**
 * MediaCache — aggressive LRU image/video preloader.
 * • Images: preloaded as JS Image objects → browser caches the response
 * • Videos: prefetch <link> + hidden <video preload="metadata"> for first frame
 * • LRU eviction keeps memory footprint bounded
 */

const MAX_IMAGE_ENTRIES = 200; // keep up to 200 preloaded images in memory
const MAX_VIDEO_ENTRIES = 30;  // keep up to 30 video preloads

class LRUCache {
    constructor(max) {
        this.max = max;
        this.map = new Map(); // key → value
    }
    has(k) { return this.map.has(k); }
    get(k) {
        if (!this.map.has(k)) return undefined;
        const v = this.map.get(k);
        this.map.delete(k);
        this.map.set(k, v); // refresh to MRU
        return v;
    }
    set(k, v) {
        if (this.map.has(k)) this.map.delete(k);
        else if (this.map.size >= this.max) {
            // evict oldest (LRU = first entry)
            this.map.delete(this.map.keys().next().value);
        }
        this.map.set(k, v);
    }
}

const _imgCache = new LRUCache(MAX_IMAGE_ENTRIES);
const _vidCache = new LRUCache(MAX_VIDEO_ENTRIES);
const _videoEls = new Map(); // videoUrl → <video> dom element

// Connection quality helpers
function _isSlowConnection() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return conn && (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType));
}
function _isMediumConnection() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return conn && conn.effectiveType === '3g';
}

const Cache = {
    // How many items to preload ahead of current index
    get AHEAD() { return _isSlowConnection() ? 3 : _isMediumConnection() ? 6 : 12; },

    /**
     * Preload a window of items around `centerIndex`.
     * @param {Array} items  — array of Google Photos media objects
     * @param {number} centerIndex
     * @param {Function} getImageURL — fn(item, width) → string
     */
    preloadAround(items, centerIndex, getImageURL) {
        const ahead = this.AHEAD;
        const start = Math.max(0, centerIndex - 2);
        const end = Math.min(items.length - 1, centerIndex + ahead);

        for (let i = start; i <= end; i++) {
            const item = items[i];
            if (!item || item._isLocal) continue;

            if (item.mediaMetadata?.video) {
                Cache._preloadVideo(item);
            } else {
                Cache._preloadImage(item, getImageURL);
            }
        }
    },

    _preloadImage(item, getImageURL) {
        if (!getImageURL || !item.baseUrl) return;
        const width = _isSlowConnection() ? 720 : 1080;
        const url = getImageURL(item, width);
        if (!url || _imgCache.has(url)) return;

        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        _imgCache.set(url, img); // keep reference so GC doesn't drop it
    },

    _preloadVideo(item) {
        if (!item.baseUrl) return;

        let url = `${item.baseUrl}=w1280-h720-dv`; // Default to 720p cap
        if (_isSlowConnection() || _isMediumConnection()) {
            url = `${item.baseUrl}=w854-h480-dv`; // 480p for 3g/2g
        }

        if (_vidCache.has(url)) return;

        // Skip on very slow connections
        if (_isSlowConnection()) return;

        // Create hidden video element for preload
        const vid = document.createElement('video');
        vid.preload = _isMediumConnection() ? 'metadata' : 'auto';
        vid.src = url;
        vid.muted = true;
        vid.playsInline = true;
        vid.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
        document.body.appendChild(vid);

        _vidCache.set(url, true);
        _videoEls.set(url, vid);

        // If cache is getting large, clean up oldest entries
        if (_videoEls.size > MAX_VIDEO_ENTRIES) {
            const firstKey = _videoEls.keys().next().value;
            const oldEl = _videoEls.get(firstKey);
            oldEl?.pause();
            oldEl?.remove();
            _videoEls.delete(firstKey);
        }
    },

    /** True if image is already loaded in browser cache */
    isImageCached(url) {
        const img = _imgCache.get(url);
        return img && img.complete && img.naturalWidth > 0;
    },

    /** Preload a simple batch of image URLs (for Gallery grid view) */
    preloadImageURLs(urls) {
        urls.forEach(url => {
            if (!url || _imgCache.has(url)) return;
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
            _imgCache.set(url, img);
        });
    },

    clear() {
        _imgCache.map.clear();
        _videoEls.forEach(el => { el.pause(); el.remove(); });
        _videoEls.clear();
        _vidCache.map.clear();
    }
};

export default Cache;
