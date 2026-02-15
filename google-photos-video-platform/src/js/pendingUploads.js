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

        console.log(`[PendingUploads] Checking ${pending.length} pending video(s)...`);
        const nowReady = [];
        const ONE_HOUR = 60 * 60 * 1000;

        for (const item of pending) {
            // Remove items older than 1 hour (stuck/failed)
            if (Date.now() - item.uploadedAt > ONE_HOUR) {
                console.warn(`[PendingUploads] Removing stale item: ${item.filename}`);
                PendingUploads.remove(item.id);
                continue;
            }

            try {
                const fresh = await API.getVideo(item.id);
                console.log(`[PendingUploads] ${item.filename} response:`, fresh);

                // If Google returns a valid mediaItem with a baseUrl, it's ready
                if (fresh && fresh.baseUrl) {
                    // Check if video status is explicitly PROCESSING
                    const videoStatus = fresh.mediaMetadata?.video?.status;
                    if (videoStatus === 'PROCESSING') {
                        console.log(`[PendingUploads] ${item.filename} still processing...`);
                        continue;
                    }
                    // Ready!
                    console.log(`[PendingUploads] ${item.filename} is READY!`);
                    nowReady.push(fresh);
                    PendingUploads.remove(item.id);
                }
            } catch (e) {
                console.warn(`[PendingUploads] Error checking ${item.filename}:`, e.message);
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
