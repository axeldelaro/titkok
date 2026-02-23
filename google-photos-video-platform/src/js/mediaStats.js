/**
 * MediaStats — tracks view counts per media item for "Top Media" feature.
 * All data stored in localStorage, keyed by media ID.
 */

const STATS_KEY = 'mediaStats_views';
const MAX_ENTRIES = 500;

const MediaStats = {
    /** Record a view for a given media item */
    recordView(mediaId) {
        if (!mediaId) return;
        const data = MediaStats._load();
        if (!data[mediaId]) data[mediaId] = { count: 0, lastSeen: 0 };
        data[mediaId].count++;
        data[mediaId].lastSeen = Date.now();
        MediaStats._save(data);
    },

    /** Get top N media items sorted by view count */
    getTop(n = 10) {
        const data = MediaStats._load();
        return Object.entries(data)
            .map(([id, v]) => ({ id, count: v.count, lastSeen: v.lastSeen }))
            .sort((a, b) => b.count - a.count)
            .slice(0, n);
    },

    /** Get view count for a specific media ID */
    getCount(mediaId) {
        return MediaStats._load()[mediaId]?.count || 0;
    },

    /** Weighted random selection — items with fewer views appear more often */
    weightedShuffle(items, getId) {
        const data = MediaStats._load();
        const maxCount = Math.max(...items.map(it => data[getId(it)]?.count || 0), 1);

        // Score = inverse of views (more views = lower score = less likely to appear first)
        const scored = items.map(item => {
            const views = data[getId(item)]?.count || 0;
            // Weight: unseen items get weight 10, most-seen gets ~1
            const weight = Math.max(1, 10 - Math.floor((views / maxCount) * 9));
            return { item, score: Math.random() * weight };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.item);
    },

    _load() {
        try {
            return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
        } catch { return {}; }
    },

    _save(data) {
        // Prune if too large
        const entries = Object.entries(data);
        if (entries.length > MAX_ENTRIES) {
            const pruned = entries
                .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
                .slice(0, MAX_ENTRIES);
            data = Object.fromEntries(pruned);
        }
        try { localStorage.setItem(STATS_KEY, JSON.stringify(data)); } catch { }
    }
};

export default MediaStats;
