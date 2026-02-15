import API from './api.js';
import Storage from './storage.js';

const STORAGE_KEY = 'pendingUploads';
const POLL_INTERVAL = 15000; // 15 seconds

let pollTimer = null;
let onReadyCallback = null;

const PendingUploads = {
    // Add a newly uploaded video to the pending queue
    add(mediaItem) {
        const pending = PendingUploads.getAll();
        pending.push({
            id: mediaItem.id,
            filename: mediaItem.filename || 'Untitled',
            uploadedAt: Date.now()
        });
        Storage.set(STORAGE_KEY, pending);
        PendingUploads.startPolling();
    },

    // Get all pending uploads
    getAll() {
        return Storage.get(STORAGE_KEY) || [];
    },

    // Remove a video from pending (it's now ready)
    remove(videoId) {
        const pending = PendingUploads.getAll().filter(p => p.id !== videoId);
        Storage.set(STORAGE_KEY, pending);
        if (pending.length === 0) {
            PendingUploads.stopPolling();
        }
    },

    // Check if any pending videos are now ready
    async checkReady() {
        const pending = PendingUploads.getAll();
        if (pending.length === 0) {
            PendingUploads.stopPolling();
            return;
        }

        const nowReady = [];

        for (const item of pending) {
            try {
                const fresh = await API.getVideo(item.id);
                if (fresh && fresh.mediaMetadata && fresh.mediaMetadata.video) {
                    const status = fresh.mediaMetadata.video.status;
                    if (status === 'READY' || status === undefined) {
                        // Video is ready to play
                        nowReady.push(fresh);
                        PendingUploads.remove(item.id);
                    }
                }
            } catch (e) {
                console.warn(`Still waiting for video ${item.id}:`, e.message);
            }
        }

        if (nowReady.length > 0 && onReadyCallback) {
            onReadyCallback(nowReady);
        }
    },

    // Start polling for ready videos
    startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(() => PendingUploads.checkReady(), POLL_INTERVAL);
        // Also check immediately
        PendingUploads.checkReady();
    },

    // Stop polling
    stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    },

    // Register a callback when videos become ready
    onReady(callback) {
        onReadyCallback = callback;
    },

    // Create a visual "processing" card element for the feed
    createPendingCard(item) {
        const card = document.createElement('div');
        card.className = 'video-card-feed pending-video';
        card.dataset.id = item.id;
        card.innerHTML = `
            <div class="pending-overlay">
                <div class="player-spinner"></div>
                <h3 style="margin:0.5rem 0 0.25rem;">${item.filename}</h3>
                <p style="font-size:0.8rem;color:var(--text-secondary,#aaa);margin:0;">
                    Processing by Google Photos…
                </p>
                <p style="font-size:0.7rem;color:var(--text-secondary,#888);margin:0.25rem 0 0;">
                    Video will appear automatically when ready
                </p>
            </div>
        `;
        return card;
    }
};

export default PendingUploads;
