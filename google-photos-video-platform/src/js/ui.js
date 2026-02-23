import Store from './store.js';
import Router from './router.js';
import Auth from './auth.js';
import API from './api.js';
import VideoCard from '../components/videoCard.js';
import Loader from '../components/loader.js';
import Navbar from '../components/navbar.js';
import Sidebar from '../components/sidebar.js';
import Player from './player.js';
import Likes from './likes.js';
import Gallery from './gallery.js';
import History from './history.js';
import { Toast } from '../components/toast.js';
import Modal from '../components/modal.js';
import HypnoPopups, { getConfig, updateConfig } from './hypno.js';
import VisualEditor from './visual-editor.js';
import FaceEditor from './face-editor.js';
import Cache from './cache.js';
import MediaStats from './mediaStats.js';
import { ALL_NAV_ITEMS, getVisibleItems, setVisibleItems } from '../components/sidebar.js';

const UI = {
    init: () => {
        const app = document.getElementById('app');
        VisualEditor.init();

        // Render Shell
        app.innerHTML = '';
        app.appendChild(Navbar());

        const mainContainer = document.createElement('div');
        mainContainer.className = 'main-container';

        const sidebar = Sidebar();
        mainContainer.appendChild(sidebar);

        const content = document.createElement('main');
        content.id = 'content';
        content.className = 'content';
        mainContainer.appendChild(content);

        app.appendChild(mainContainer);

        // Hidden Upload Input
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.accept = 'video/*';
        uploadInput.multiple = true;
        uploadInput.style.display = 'none';
        app.appendChild(uploadInput);

        // Upload Logic
        document.addEventListener('triggerUpload', () => {
            // Show explanation first
            const modalContent = `
                <div class="text-center">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                        Using the <b>Restricted Scope</b> (appcreateddata), this app can ONLY display videos that were uploaded 
                        <strong>through this app</strong>.
                    </p>
                    <p style="margin-bottom: 1.5rem;">
                        Select one or more video files from your <strong>device</strong> to upload to your Google Photos library.
                        Once uploaded, they will appear in your feed here.
                    </p>
                    <button id="confirm-upload-btn" class="btn-primary" style="width:100%">
                        Select Video(s)
                    </button>
                </div>
            `;

            const modal = Modal('Upload to Google Photos', modalContent);
            document.body.appendChild(modal);

            modal.querySelector('#confirm-upload-btn').onclick = () => {
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
                uploadInput.click();
            };
        });

        uploadInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            // Reset input so same files can be selected again if needed
            uploadInput.value = '';

            // ── INSTANT LOCAL PLAYBACK ──
            // Create blob URLs from the files so they appear in the feed immediately
            const localVideos = files.map(file => ({
                id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                filename: file.name,
                baseUrl: URL.createObjectURL(file),
                _isLocal: true,
                mediaMetadata: {
                    creationTime: new Date().toISOString(),
                    video: {}
                }
            }));

            // Prepend local videos to the store for instant display
            const existing = Store.get('videos') || [];
            Store.set('videos', [...localVideos, ...existing]);

            // Re-render feed to show them NOW
            Toast.show(`${files.length} video${files.length > 1 ? 's' : ''} ready to watch! Uploading to Google Photos...`, 'info', 4000);
            if (window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#') {
                const contentEl = document.getElementById('content');
                if (contentEl) UI.renderHome(contentEl);
            } else {
                window.location.hash = '#/';
            }

            // ── BACKGROUND UPLOAD ──
            const total = files.length;
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < total; i++) {
                const file = files[i];
                try {
                    await API.uploadVideo(file);
                    successCount++;
                } catch (err) {
                    console.error(`Upload failed for ${file.name}:`, err);
                    Toast.show(`Upload failed: ${file.name}`, 'error');
                    failCount++;
                }
            }

            // Summary toast
            if (successCount > 0) {
                Toast.show(`✅ ${successCount}/${total} uploaded to Google Photos!`, 'success');
            }

            // Clean up: after upload finishes, re-fetch from API to get real URLs
            if (successCount > 0) {
                // Wait a few seconds for Google to process, then refresh silently
                setTimeout(() => {
                    // Only fetch new items, DO NOT wipe the array which kills the currently playing local blobs!
                    if (window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#') {
                        // Refresh home silently
                        // UI.renderHome(document.getElementById('content'));
                        // Actually, wiping and refreshing abruptly ruins the UX. It's better to just leave
                        // the local blobs playing until the user manually refreshes the page. 
                    }
                }, 10000);
            }
        };

        // Listen for Route Changes
        window.addEventListener('routeChange', (e) => UI.handleRoute(e.detail));

        // Sidebar Toggle
        document.addEventListener('toggleSidebar', () => {
            sidebar.classList.toggle('hidden');
            if (sidebar.style.display === 'none') {
                sidebar.style.display = 'block';
                sidebar.style.position = 'absolute';
                sidebar.style.zIndex = '1000';
                sidebar.style.height = '100%';
            } else {
                sidebar.style.display = '';
            }
        });

        // Initialize features
        Likes.init();
        Gallery.init();
        History.init();

        // #32 Scroll-to-Top FAB
        const scrollBtn = document.createElement('button');
        scrollBtn.className = 'scroll-top-btn';
        scrollBtn.innerHTML = '⬆';
        scrollBtn.onclick = () => content.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.appendChild(scrollBtn);
        content.addEventListener('scroll', () => {
            scrollBtn.classList.toggle('visible', content.scrollTop > 600);
        });

        // #36 Drag & Drop Upload Overlay
        const dragOverlay = document.createElement('div');
        dragOverlay.className = 'drag-drop-overlay';
        dragOverlay.innerHTML = '<div class="drag-drop-inner"><span>📁</span>Drop files to upload</div>';
        document.body.appendChild(dragOverlay);
        let dragCounter = 0;
        document.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; dragOverlay.classList.add('active'); });
        document.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('active'); } });
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            dragOverlay.classList.remove('active');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
            if (files.length > 0) {
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                uploadInput.files = dt.files;
                uploadInput.dispatchEvent(new Event('change'));
            }
        });
    },

    handleRoute: async (route) => {
        HypnoPopups.detach();
        const content = document.getElementById('content');
        content.innerHTML = '';

        if (!Auth.isAuthenticated() && route.path !== '/login') {
            content.innerHTML = `
                <div class="login-hero">
                    <div class="login-hero-icon">▶</div>
                    <h2>Welcome to CloudStream</h2>
                    <p class="text-secondary">Stream your Google Photos videos in a beautiful interface.</p>
                    <button id="login-hero" class="btn-primary btn-lg">
                        <span>🔑</span> Sign In with Google
                    </button>
                </div>
             `;
            content.querySelector('#login-hero').onclick = () => Auth.login();
            return;
        }

        switch (route.route) {
            case 'home':
                UI.renderHome(content);
                break;
            case 'video':
                const id = route.params.get('id');
                if (id) UI.renderVideo(content, id);
                else Router.navigate('/');
                break;
            case 'likes':
                UI.renderLikes(content);
                break;
            case 'mix':
                UI.renderMix(content);
                break;
            case 'gallery':
                UI.renderGallery(content);
                break;
            case 'profile':
                UI.renderProfile(content);
                break;
            case 'search':
                const query = route.params.get('q');
                if (query) UI.renderSearch(content, query);
                else Router.navigate('/');
                break;
            case 'history':
                UI.renderHistory(content);
                break;
            case 'stats':
                UI.renderStats(content);
                break;
            default:
                content.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-state-icon">🔍</span>
                        <h2>404 — Page Not Found</h2>
                        <p class="text-secondary">The page you're looking for doesn't exist.</p>
                        <a href="#/" class="btn-primary" style="display:inline-block;margin-top:1rem;">Go Home</a>
                    </div>`;
        }
    },

    renderHome: async (container) => { /* VIRTUALIZED */
        container.className = 'content feed-container';

        try {
            let videos = Store.get('videos');
            const hiddenIds = Store.getHiddenIds();

            if (videos.length === 0) {
                // Load ALL pages from the API
                let nextPageToken = null;
                let allVideos = [];
                do {
                    const data = await API.searchVideos(nextPageToken);
                    if (data && data.mediaItems) {
                        const pageVideos = data.mediaItems.filter(item => item.mediaMetadata && item.mediaMetadata.video);
                        allVideos = allVideos.concat(pageVideos);
                    }
                    nextPageToken = data ? data.nextPageToken : null;
                } while (nextPageToken);

                videos = allVideos;
                Store.set('videos', videos);
                Store.set('nextPageToken', null); // All loaded
            }

            // Filter out videos the user has deleted
            if (hiddenIds.length > 0) {
                videos = videos.filter(v => !hiddenIds.includes(v.id));
            }

            container.innerHTML = '';

            if (videos.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-state-icon">📹</span>
                        <h2>No Videos Found</h2>
                        <p class="text-secondary">Upload a video to get started!</p>
                        <button id="feed-upload-btn" class="btn-primary" style="margin-top:1rem;">Upload Video</button>
                    </div>`;
                container.querySelector('#feed-upload-btn').onclick = () => document.dispatchEvent(new CustomEvent('triggerUpload'));
                return;
            }

            const feed = document.createElement('div');
            feed.className = 'video-feed';

            // Shuffle button
            const shuffleBtn = document.createElement('button');
            shuffleBtn.className = 'feed-shuffle-btn';
            shuffleBtn.innerHTML = '🔀';
            shuffleBtn.title = 'Shuffle';
            shuffleBtn.onclick = () => {
                const arr = Store.get('videos');
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                Store.set('videos', arr);
                UI.renderHome(container);
                Toast.show('Videos shuffled! 🔀');
            };
            container.appendChild(shuffleBtn);

            // Helper: detect portrait from metadata
            const isPortraitVideo = (video) => {
                const meta = video.mediaMetadata || {};
                let w = parseInt(meta.width) || 0;
                let h = parseInt(meta.height) || 0;
                if ((!w || !h) && meta.video) { w = parseInt(meta.video.width) || w; h = parseInt(meta.video.height) || h; }
                return h > w && w > 0;
            };

            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            const PRELOAD_AHEAD = conn?.saveData || conn?.effectiveType === '2g' ? 0
                : conn?.effectiveType === '3g' ? 1 : 2;

            // ─── VIRTUAL DOM POOL ───────────────────────────────────────────────
            // Only BUFFER cards above/below the current visible card have live Players.
            // All other positions are lightweight placeholder divs.
            // This prevents 800 simultaneous Player instances and canvas RAF loops.
            const BUFFER = 4;
            const liveCards = new Map(); // index → card element with _player

            const makePlaceholder = (idx) => {
                const ph = document.createElement('div');
                ph.className = 'video-card-feed video-card-placeholder';
                ph.dataset.vidIdx = idx;
                return ph;
            };

            const buildCard = (video, idx) => {
                const card = document.createElement('div');
                card.dataset.vidIdx = idx;
                card.dataset.id = video.id;
                const isPortrait = isPortraitVideo(video);
                card.className = `video-card-feed${isPortrait ? ' portrait' : ''}`;

                const playerContainer = document.createElement('div');
                playerContainer.className = 'feed-player-container';
                const player = new Player(playerContainer, video.baseUrl, video.baseUrl, { lazy: true, mediaItemId: video.id });
                card._player = player;

                // Track view for stats
                MediaStats.recordView(video.id);

                if (!isPortrait && player.video) {
                    player.video.addEventListener('loadedmetadata', () => {
                        if (player.video.videoHeight > player.video.videoWidth) card.classList.add('portrait');
                    });
                }

                // Feature E: Long-press on video card = speed picker
                let longPressTimer;
                card.addEventListener('pointerdown', () => {
                    longPressTimer = setTimeout(() => {
                        const existing = document.querySelector('.feed-speed-popup');
                        if (existing) { existing.remove(); return; }
                        const popup = document.createElement('div');
                        popup.className = 'feed-speed-popup';
                        popup.innerHTML = '[0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×]'
                            .replace(/\[|\]/g, '')
                            .split(', ')
                            .map(s => `<button class="speed-opt${s === '1×' ? ' active' : ''}" data-rate="${parseFloat(s)}">${s}</button>`)
                            .join('');
                        card.appendChild(popup);
                        popup.querySelectorAll('.speed-opt').forEach(btn => {
                            btn.onclick = (e) => {
                                e.stopPropagation();
                                const rate = parseFloat(btn.dataset.rate);
                                player.video.playbackRate = rate;
                                player.trailVideos.forEach(v => v.playbackRate = rate);
                                popup.querySelectorAll('.speed-opt').forEach(b => b.classList.remove('active'));
                                btn.classList.add('active');
                                setTimeout(() => popup.remove(), 600);
                            };
                        });
                        setTimeout(() => popup.remove(), 4000);
                    }, 600);
                }, { passive: true });
                card.addEventListener('pointerup', () => clearTimeout(longPressTimer), { passive: true });
                card.addEventListener('pointercancel', () => clearTimeout(longPressTimer), { passive: true });

                const infoOverlay = document.createElement('div');
                infoOverlay.className = 'feed-info-overlay';
                infoOverlay.innerHTML = `<h3>${video.filename}</h3>`;

                const actions = document.createElement('div');
                actions.className = 'feed-actions';
                actions.innerHTML = `
                    <button class="btn-icon like-btn" title="Like">${Likes.isLiked(video.id) ? '❤️' : '🤍'}</button>
                    <button class="btn-icon share-btn" title="Copy Link">🔗</button>
                    <button class="btn-icon delete-btn" title="Remove from feed">🗑️</button>
                `;
                actions.querySelector('.like-btn').onclick = (e) => {
                    e.stopPropagation();
                    e.currentTarget.textContent = Likes.toggleLike(video) ? '❤️' : '🤍';
                };
                actions.querySelector('.share-btn').onclick = (e) => {
                    e.stopPropagation();
                    if (video._isLocal) { Toast.show('Link available after upload completes', 'info'); return; }
                    navigator.clipboard.writeText(`${window.location.origin}/#/video?id=${video.id}`);
                    Toast.show('Link copied!');
                };
                actions.querySelector('.delete-btn').onclick = (e) => {
                    e.stopPropagation();
                    if (video._isLocal && video.baseUrl) { try { URL.revokeObjectURL(video.baseUrl); } catch (ex) { } }
                    Store.removeVideo(video.id);
                    const ph = makePlaceholder(idx);
                    if (card.parentNode) feed.replaceChild(ph, card);
                    if (card._player) { card._player.destroy(); card._player = null; }
                    liveCards.delete(idx);
                    // Re-observe the placeholder
                    visibilityObserver.observe(ph);
                    Toast.show('Video removed from feed');
                };

                card.appendChild(playerContainer);
                card.appendChild(infoOverlay);
                card.appendChild(actions);

                // Double-Tap Like
                let lastTap = 0;
                playerContainer.addEventListener('pointerdown', (e) => {
                    const now = Date.now();
                    if (now - lastTap < 300) {
                        if (!Likes.isLiked(video.id)) Likes.toggleLike(video);
                        actions.querySelector('.like-btn').textContent = '❤️';
                        const heart = document.createElement('div');
                        heart.className = 'double-tap-heart';
                        heart.textContent = '❤️';
                        playerContainer.style.position = 'relative';
                        playerContainer.appendChild(heart);
                        setTimeout(() => heart.remove(), 900);
                    }
                    lastTap = now;
                });

                // Auto-Play Next
                playerContainer.addEventListener('videoEnded', () => {
                    const next = feed.children[idx + 1];
                    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });

                History.addToHistory(video);
                return card;
            };

            // Hydrate: ensure live players exist in [lo, hi]
            const hydrate = (centerIdx) => {
                const lo = Math.max(0, centerIdx - BUFFER);
                const hi = Math.min(videos.length - 1, centerIdx + BUFFER);

                // Destroy far-away cards
                for (const [i, card] of liveCards) {
                    if (i < lo || i > hi) {
                        const ph = makePlaceholder(i);
                        const slot = feed.children[i];
                        if (slot && slot !== ph) { feed.replaceChild(ph, slot); visibilityObserver.observe(ph); }
                        if (card._player) { card._player.destroy(); card._player = null; }
                        liveCards.delete(i);
                    }
                }

                // Build cards within the buffer
                for (let i = lo; i <= hi; i++) {
                    if (!liveCards.has(i)) {
                        const card = buildCard(videos[i], i);
                        liveCards.set(i, card);
                        const slot = feed.children[i];
                        if (slot) { feed.replaceChild(card, slot); visibilityObserver.observe(card); }
                    }
                }

                // Preload slightly beyond buffer
                for (let offset = 1; offset <= PRELOAD_AHEAD; offset++) {
                    [centerIdx + BUFFER + offset, centerIdx - BUFFER - offset].forEach(pi => {
                        if (pi >= 0 && pi < videos.length) liveCards.get(pi)?._player?.preload();
                    });
                }
            };

            // Observer: activate visible card, deactivate non-visible, hydrate around visible
            const visibilityObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const vidIdx = parseInt(entry.target.dataset.vidIdx, 10);
                    if (isNaN(vidIdx)) return;
                    if (entry.isIntersecting) {
                        hydrate(vidIdx);
                        const card = liveCards.get(vidIdx);
                        if (card?._player) card._player.activate();
                        for (let off = 1; off <= PRELOAD_AHEAD; off++) {
                            liveCards.get(vidIdx + off)?._player?.preload();
                        }
                    } else {
                        liveCards.get(vidIdx)?._player?.deactivate();
                    }
                });
            }, { root: feed, threshold: 0.5 });

            // ── Populate with placeholders ───────────────────────────
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < videos.length; i++) fragment.appendChild(makePlaceholder(i));
            feed.appendChild(fragment);

            // Observe all placeholders
            Array.from(feed.children).forEach(el => visibilityObserver.observe(el));

            // Keep new elements observed via MutationObserver
            new MutationObserver(muts => {
                muts.forEach(m => {
                    m.addedNodes.forEach(n => { if (n.nodeType === 1) visibilityObserver.observe(n); });
                    m.removedNodes.forEach(n => { if (n.nodeType === 1) visibilityObserver.unobserve(n); });
                });
            }).observe(feed, { childList: true });

            // Initial hydration
            hydrate(0);

            // Video count badge
            const countBadge = document.createElement('div');
            countBadge.className = 'feed-count-badge';
            countBadge.textContent = `${videos.length} videos`;
            container.appendChild(countBadge);

            container.appendChild(feed);
            // Explicitly activate the first card immediately so the first video plays
            // (IntersectionObserver fires async, this guarantees instant start)
            requestAnimationFrame(() => { liveCards.get(0)?._player?.activate(); });
            VisualEditor.reapply();
            Cache.preloadAround(videos, 0, (item, w) => `${item.baseUrl}=w${w}`);
            UI._prefetchMedia(videos, 0, 20);

        } catch (error) {
            console.error(error);
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">⚠️</span>
                    <h2>Error Loading Feed</h2>
                    <p class="text-secondary">${error.message}</p>
                </div>`;
        }
    },

    renderVideo: async (container, id) => {
        let video = Store.get('videos').find(v => v.id === id);
        if (!video) {
            try {
                video = await API.getVideo(id);
            } catch (e) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-state-icon">📹</span>
                        <h2>Video Not Found</h2>
                        <p class="text-secondary">This video may have been deleted or is no longer accessible.</p>
                    </div>`;
                return;
            }
        }



        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'video-page-wrapper';

        const playerContainer = document.createElement('div');
        new Player(playerContainer, video.baseUrl, video.baseUrl, { mediaItemId: video.id });
        wrapper.appendChild(playerContainer);

        const info = document.createElement('div');
        info.className = 'video-info';
        info.innerHTML = `
            <h1 class="video-title">${video.filename}</h1>
            <div class="video-meta">
                <span class="text-secondary">${new Date(video.mediaMetadata.creationTime).toDateString()}</span>
                <div class="video-actions">
                    <button id="like-btn" class="btn-icon" title="Like">
                        ${Likes.isLiked(video.id) ? '❤️' : '🤍'}
                    </button>
                    <button id="add-playlist-btn" class="btn-icon" title="Add to Playlist">📂</button>
                    <button id="share-btn" class="btn-icon" title="Copy Link">🔗</button>
                    <button id="delete-video-btn" class="btn-icon" title="Remove from feed" style="color:#ef4444;">🗑️</button>
                </div>
            </div>
        `;

        // Like Logic
        const likeBtn = info.querySelector('#like-btn');
        likeBtn.onclick = () => {
            const isLiked = Likes.toggleLike(video);
            likeBtn.innerHTML = isLiked ? '❤️' : '🤍';
            Toast.show(isLiked ? 'Added to Liked Videos' : 'Removed from Liked Videos');
        };

        // Add to Playlist Logic
        const addPlaylistBtn = info.querySelector('#add-playlist-btn');
        addPlaylistBtn.onclick = () => {
            UI.showAddToPlaylistModal(video);
        };

        // #38 Share Modal (rich)
        const shareBtn = info.querySelector('#share-btn');
        shareBtn.onclick = () => {
            const url = `${window.location.origin}/#/video?id=${video.id}`;
            const shareContent = `
                <div class="share-menu">
                    <button class="share-btn" data-action="copy"><span>📋</span>Copy Link</button>
                    <button class="share-btn" data-action="twitter"><span>🐦</span>Twitter</button>
                    <button class="share-btn" data-action="whatsapp"><span>💬</span>WhatsApp</button>
                    <button class="share-btn" data-action="email"><span>📧</span>Email</button>
                </div>
                <div style="margin-top:10px;background:var(--bg-color);padding:8px 12px;border-radius:var(--radius-md);font-size:0.8rem;word-break:break-all;color:var(--text-secondary);">${url}</div>
            `;
            const shareModal = Modal('Share Video', shareContent);
            document.body.appendChild(shareModal);
            shareModal.querySelectorAll('.share-btn').forEach(btn => {
                btn.onclick = () => {
                    const action = btn.dataset.action;
                    if (action === 'copy') {
                        navigator.clipboard.writeText(url);
                        Toast.show('Link copied!', 'success');
                    } else if (action === 'twitter') {
                        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(video.filename)}`);
                    } else if (action === 'whatsapp') {
                        window.open(`https://wa.me/?text=${encodeURIComponent(video.filename + ' ' + url)}`);
                    } else if (action === 'email') {
                        window.open(`mailto:?subject=${encodeURIComponent(video.filename)}&body=${encodeURIComponent(url)}`);
                    }
                    shareModal.classList.remove('open');
                    setTimeout(() => shareModal.remove(), 300);
                };
            });
        };

        // Delete / Remove from feed
        const deleteBtn = info.querySelector('#delete-video-btn');
        deleteBtn.onclick = () => {
            if (confirm(`Remove "${video.filename}" from your feed?`)) {
                Store.removeVideo(video.id);
                Toast.show('Video removed from feed');
                Router.navigate('/');
            }
        };

        wrapper.appendChild(info);

        // #13 Video Notes
        const notesKey = `video_notes_${video.id}`;
        const notesSection = document.createElement('div');
        notesSection.className = 'video-notes-section';
        notesSection.innerHTML = `
            <h3>📝 Notes</h3>
            <textarea class="video-notes-textarea" placeholder="Add personal notes about this video...">${localStorage.getItem(notesKey) || ''}</textarea>
        `;
        const textarea = notesSection.querySelector('textarea');
        let noteSaveTimer;
        textarea.oninput = () => {
            clearTimeout(noteSaveTimer);
            noteSaveTimer = setTimeout(() => {
                localStorage.setItem(notesKey, textarea.value);
                Toast.show('Note saved', 'success', 1500);
            }, 800);
        };
        wrapper.appendChild(notesSection);

        container.appendChild(wrapper);

        // #14 Add to History on video page view
        History.addToHistory(video);
    },

    renderLikes: (container) => {
        const likes = Likes.getLikes();

        container.innerHTML = `
            <div class="section-header">
                <h2>❤️ Liked Videos</h2>
                <span class="text-secondary">${likes.length} video${likes.length !== 1 ? 's' : ''}</span>
            </div>
        `;

        if (likes.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <span class="empty-state-icon">🤍</span>
                    <h2>No Liked Videos</h2>
                    <p class="text-secondary">Videos you like will appear here.</p>
                </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'video-grid';
        likes.forEach(video => {
            grid.appendChild(VideoCard(video));
        });
        container.appendChild(grid);
    },

    renderMix: async (container) => {
        container.className = 'content feed-container';
        container.innerHTML = '';

        // ── Load both videos and images ──
        let videos = Store.get('videos') || [];
        if (videos.length === 0) {
            container.appendChild(Loader());
            let nextPageToken = null;
            let allVideos = [];
            do {
                const data = await API.searchVideos(nextPageToken);
                if (data && data.mediaItems) {
                    allVideos = allVideos.concat(data.mediaItems.filter(item => item.mediaMetadata && item.mediaMetadata.video));
                }
                nextPageToken = data ? data.nextPageToken : null;
            } while (nextPageToken);
            videos = allVideos;
            Store.set('videos', videos);
            container.innerHTML = '';
        }

        // Wait for gallery images
        if (Gallery.isLoading()) {
            container.appendChild(Loader());
            let waited = 0;
            while (Gallery.isLoading() && waited < 20000) {
                await new Promise(r => setTimeout(r, 500));
                waited += 500;
            }
            container.innerHTML = '';
        } else if (!Gallery.isLoaded() && Gallery.getAll().length === 0) {
            container.appendChild(Loader());
            await Gallery.fetchAllImages();
            container.innerHTML = '';
        }
        const images = Gallery.getAll();

        // Filter hidden videos
        const hiddenIds = Store.getHiddenIds();
        if (hiddenIds.length > 0) {
            videos = videos.filter(v => !hiddenIds.includes(v.id));
        }

        // ── Merge and weighted-shuffle (H: unseen/rare items first) ──
        const rawItems = [
            ...videos.map(v => ({ type: 'video', data: v })),
            ...images.map(img => ({ type: 'image', data: img }))
        ];
        const mixItems = MediaStats.weightedShuffle(rawItems, item => item.data.id);

        if (mixItems.length === 0) {
            container.className = 'content';
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">🔀</span>
                    <h2>No Media Yet</h2>
                    <p class="text-secondary">Upload videos or images to see them here in a mixed feed.</p>
                </div>`;
            return;
        }

        // ── Floating buttons ──
        const shuffleBtn = document.createElement('button');
        shuffleBtn.className = 'feed-shuffle-btn';
        shuffleBtn.innerHTML = '🔀';
        shuffleBtn.title = 'Shuffle Mix';
        shuffleBtn.onclick = () => {
            UI.renderMix(container);
            Toast.show('Mix shuffled! 🔀');
        };
        container.appendChild(shuffleBtn);

        // ── Slideshow button ──
        const slideshowBtn = document.createElement('button');
        slideshowBtn.className = 'slideshow-float-btn';
        slideshowBtn.innerHTML = '▶';
        slideshowBtn.title = 'Slideshow';
        container.appendChild(slideshowBtn);
        slideshowBtn.onclick = () => UI._openSlideshow(mixItems, container);

        // Upload button
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'gallery-float-upload';
        uploadBtn.innerHTML = '📤';
        uploadBtn.title = 'Upload Media';
        container.appendChild(uploadBtn);

        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.accept = 'image/*,video/*';
        uploadInput.multiple = true;
        uploadInput.style.display = 'none';
        container.appendChild(uploadInput);
        uploadBtn.onclick = () => uploadInput.click();
        uploadInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            uploadInput.value = '';

            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            const videoFiles = files.filter(f => f.type.startsWith('video/'));

            // Handle images with instant preview
            if (imageFiles.length > 0) {
                Gallery.addLocalImages(imageFiles);
                Toast.show(`${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} added! Uploading...`, 'info', 4000);
                Gallery.uploadImages(imageFiles, {
                    onFileStart: (file, idx) => Toast.show(`📤 Image ${idx + 1}/${imageFiles.length}: ${file.name}`, 'info', 2000),
                    onFileComplete: () => { },
                    onFileError: (file) => Toast.show(`❌ Failed: ${file.name}`, 'error')
                }).then(() => {
                    Toast.show('✅ Images uploaded!', 'success');
                    setTimeout(() => {
                        Gallery.removeLocalImages();
                        Gallery.fetchAllImages();
                    }, 8000);
                });
            }

            // Handle videos with instant preview
            if (videoFiles.length > 0) {
                const localVideos = videoFiles.map(file => ({
                    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    filename: file.name,
                    baseUrl: URL.createObjectURL(file),
                    _isLocal: true,
                    mediaMetadata: { creationTime: new Date().toISOString(), video: {} }
                }));
                Store.set('videos', [...localVideos, ...Store.get('videos')]);
                Toast.show(`${videoFiles.length} video${videoFiles.length > 1 ? 's' : ''} added! Uploading...`, 'info', 4000);

                (async () => {
                    let ok = 0;
                    for (const file of videoFiles) {
                        try {
                            await API.uploadVideo(file);
                            ok++;
                        } catch (err) {
                            Toast.show(`❌ Failed: ${file.name}`, 'error');
                        }
                    }
                    if (ok > 0) {
                        Toast.show(`✅ ${ok} video${ok > 1 ? 's' : ''} uploaded!`, 'success');
                        setTimeout(() => {
                            Store.set('videos', []);
                            Store.set('nextPageToken', null);
                        }, 10000);
                    }
                })();
            }

            // Re-render
            UI.renderMix(container);
        };

        // Count badge
        const countBadge = document.createElement('div');
        countBadge.className = 'feed-count-badge';
        countBadge.textContent = `${mixItems.length} items (${videos.length}🎬 ${images.length}🖼️)`;
        container.appendChild(countBadge);

        // ── TikTok feed ──
        const feed = document.createElement('div');
        feed.className = 'video-feed';

        const isPortraitVideo = (video) => {
            const meta = video.mediaMetadata || {};
            let w = parseInt(meta.width) || 0;
            let h = parseInt(meta.height) || 0;
            if ((!w || !h) && meta.video) { w = parseInt(meta.video.width) || w; h = parseInt(meta.video.height) || h; }
            return h > w && w > 0;
        };

        // ─── VIRTUAL DOM POOL for Mix ────────────────────────────────
        // Image cards are always cheap. Only video cards need Player instances.
        // We keep BUFFER video-players alive on each side of the visible card.
        const BUFFER = 4;
        const liveCards = new Map(); // mixIdx → live card element (videos only)

        const buildVideoCard = (video, idx) => {
            const card = document.createElement('div');
            card.dataset.mixIdx = idx;
            const isPortrait = isPortraitVideo(video);
            card.className = `video-card-feed${isPortrait ? ' portrait' : ''}`;

            const playerContainer = document.createElement('div');
            playerContainer.className = 'feed-player-container';
            const player = new Player(playerContainer, video.baseUrl, video.baseUrl, { lazy: true, mediaItemId: video.id });
            card._player = player;

            if (!isPortrait && player.video) {
                player.video.addEventListener('loadedmetadata', () => {
                    if (player.video.videoHeight > player.video.videoWidth) card.classList.add('portrait');
                });
            }

            const infoOverlay = document.createElement('div');
            infoOverlay.className = 'feed-info-overlay';
            infoOverlay.innerHTML = `<h3>🎬 ${video.filename}</h3>`;

            const actions = document.createElement('div');
            actions.className = 'feed-actions';
            actions.innerHTML = `
                <button class="btn-icon like-btn" title="Like">${Likes.isLiked(video.id) ? '❤️' : '🤍'}</button>
                <button class="btn-icon share-btn" title="Copy Link">🔗</button>
            `;
            actions.querySelector('.like-btn').onclick = (e) => {
                e.stopPropagation();
                e.currentTarget.textContent = Likes.toggleLike(video) ? '❤️' : '🤍';
            };
            actions.querySelector('.share-btn').onclick = (e) => {
                e.stopPropagation();
                if (video._isLocal) { Toast.show('Link available after upload', 'info'); return; }
                navigator.clipboard.writeText(`${window.location.origin}/#/video?id=${video.id}`);
                Toast.show('Link copied!');
            };

            card.appendChild(playerContainer);
            card.appendChild(infoOverlay);
            card.appendChild(actions);
            return card;
        };

        const buildImageCard = (image, idx) => {
            const card = document.createElement('div');
            card.className = 'video-card-feed gallery-card';
            card.dataset.mixIdx = idx;

            const imgContainer = document.createElement('div');
            imgContainer.className = 'gallery-img-container';

            const img = document.createElement('img');
            img.src = Gallery.getImageURL(image);
            img.alt = image.filename || 'Image';
            img.draggable = false;
            img.loading = 'lazy';
            img.decoding = 'async';

            const meta = image.mediaMetadata || {};
            const w = parseInt(meta.width) || 0;
            const h = parseInt(meta.height) || 0;
            if (h > w * 1.2) { card.classList.add('portrait'); img.classList.add('gallery-img-portrait'); }
            else { img.classList.add('gallery-img-landscape'); }

            imgContainer.appendChild(img);
            card.appendChild(imgContainer);

            const info = document.createElement('div');
            info.className = 'feed-info-overlay';
            info.innerHTML = `<h3>🖼️ ${image.filename || 'Image'}</h3>`;
            card.appendChild(info);

            const actions = document.createElement('div');
            actions.className = 'feed-actions';
            actions.innerHTML = `<button class="btn-icon edit-btn" title="AI Retouch">🪄</button>`;
            actions.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); FaceEditor.open(image); };
            card.appendChild(actions);

            return card; // image cards have no _player
        };

        const makePlaceholder = (idx) => {
            const ph = document.createElement('div');
            ph.className = 'video-card-feed video-card-placeholder';
            ph.dataset.mixIdx = idx;
            return ph;
        };

        const hydrate = (centerIdx) => {
            const lo = Math.max(0, centerIdx - BUFFER);
            const hi = Math.min(mixItems.length - 1, centerIdx + BUFFER);

            // Destroy video players far from center
            for (const [i, card] of liveCards) {
                if (i < lo || i > hi) {
                    const ph = makePlaceholder(i);
                    const slot = feed.children[i];
                    if (slot) { feed.replaceChild(ph, slot); mixObserver.observe(ph); }
                    if (card._player) { card._player.destroy(); card._player = null; }
                    liveCards.delete(i);
                }
            }

            // Build live cards within buffer
            for (let i = lo; i <= hi; i++) {
                const slot = feed.children[i];
                if (!slot || slot.classList.contains('video-card-placeholder')) {
                    const item = mixItems[i];
                    let card;
                    if (item.type === 'video') {
                        card = buildVideoCard(item.data, i);
                        liveCards.set(i, card);
                    } else {
                        card = buildImageCard(item.data, i);
                    }
                    if (slot) { feed.replaceChild(card, slot); mixObserver.observe(card); }
                }
            }
        };

        const mixObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const el = entry.target;
                const mixIdx = parseInt(el.dataset.mixIdx, 10);
                if (isNaN(mixIdx)) return;

                if (entry.isIntersecting) {
                    countBadge.textContent = `${mixIdx + 1} / ${mixItems.length}`;
                    hydrate(mixIdx);
                    const card = liveCards.get(mixIdx); // only for video cards
                    if (card?._player) card._player.activate();
                } else {
                    liveCards.get(mixIdx)?._player?.deactivate();
                }
            });
        }, { root: null, threshold: 0.5 });

        // Populate with placeholder for video, real card for images (images are cheap)
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < mixItems.length; i++) {
            const item = mixItems[i];
            if (item.type === 'image') {
                fragment.appendChild(buildImageCard(item.data, i)); // always build cheaply
            } else {
                fragment.appendChild(makePlaceholder(i)); // defer player creation
            }
        }
        feed.appendChild(fragment);

        // Observe all initial children
        Array.from(feed.children).forEach(el => mixObserver.observe(el));

        // Keep new elements observed
        new MutationObserver(muts => {
            muts.forEach(m => {
                m.addedNodes.forEach(n => { if (n.nodeType === 1) mixObserver.observe(n); });
                m.removedNodes.forEach(n => { if (n.nodeType === 1) mixObserver.unobserve(n); });
            });
        }).observe(feed, { childList: true });

        // Hydrate the first few immediately
        hydrate(0);

        container.appendChild(feed);
        // Explicitly activate the first video card
        requestAnimationFrame(() => { liveCards.get(0)?._player?.activate(); });
        HypnoPopups.attach(container);
        VisualEditor.reapply();
        const allMedia = mixItems.map(item => item.data);
        Cache.preloadAround(allMedia, 0, (item, w) =>
            item.mediaMetadata?.video ? `${item.baseUrl}=dv` : `${item.baseUrl}=w${w}`);
        UI._prefetchMedia(allMedia, 0, 40);

        // Also hook into intersection observer to cache-ahead as user scrolls
        const cacheObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const idx = parseInt(entry.target.dataset.mixIdx ?? entry.target.dataset.idx ?? '-1', 10);
                if (isNaN(idx) || idx < 0) return;
                Cache.preloadAround(allMedia, idx, (item, w) =>
                    item.mediaMetadata?.video ? `${item.baseUrl}=dv` : `${item.baseUrl}=w${w}`);
            });
        }, { threshold: 0.01 });
        Array.from(feed.children).forEach(el => cacheObserver.observe(el));
        new MutationObserver(muts => {
            muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) cacheObserver.observe(n); }));
        }).observe(feed, { childList: true });
    },

    renderGallery: async (container) => {
        container.className = 'content feed-container';
        container.innerHTML = '';

        // ── Wait for gallery to load if still fetching ──
        if (Gallery.isLoading() || (!Gallery.isLoaded() && Gallery.getAll().length === 0)) {
            container.appendChild(Loader());
            // Wait for loading to complete (poll every 500ms, max 30s)
            let waited = 0;
            while (Gallery.isLoading() && waited < 30000) {
                await new Promise(r => setTimeout(r, 500));
                waited += 500;
            }
            // If STILL nothing after loading finished, might need a fresh fetch
            if (Gallery.getAll().length === 0 && !Gallery.isLoaded()) {
                await Gallery.fetchAllImages();
            }
            container.innerHTML = '';
        }

        const images = Gallery.getShuffled();

        // ── Upload handler (reused in empty state and floating button) ──
        const handleUpload = async (files) => {
            if (files.length === 0) return;

            // ── INSTANT LOCAL PREVIEW ──
            Gallery.addLocalImages(files);

            // Re-render to show them NOW
            Toast.show(`${files.length} image${files.length > 1 ? 's' : ''} ready! Uploading to Google Photos...`, 'info', 4000);
            const isOnGallery = window.location.hash === '#/gallery';
            if (isOnGallery) {
                const contentEl = document.getElementById('content');
                if (contentEl) UI.renderGallery(contentEl);
            }

            // ── BACKGROUND UPLOAD with per-file tracking ──
            let successCount = 0;
            let failCount = 0;

            await Gallery.uploadImages(files, {
                onFileStart: (file, idx, total) => {
                    Toast.show(`📤 Uploading ${idx + 1}/${total}: ${file.name}`, 'info', 3000);
                },
                onFileComplete: (file, idx, total) => {
                    successCount++;
                },
                onFileError: (file, idx, total, err) => {
                    failCount++;
                    Toast.show(`❌ Failed: ${file.name}`, 'error');
                }
            });

            // Summary
            if (successCount > 0) {
                Toast.show(`✅ ${successCount}/${files.length} uploaded to Google Photos!`, 'success');
            }

            // Cleanup: after uploads finish, re-fetch to get real URLs
            if (successCount > 0) {
                setTimeout(async () => {
                    Gallery.removeLocalImages();
                    await Gallery.fetchAllImages();
                    if (window.location.hash === '#/gallery') {
                        const contentEl = document.getElementById('content');
                        if (contentEl) UI.renderGallery(contentEl);
                    }
                }, 8000); // 8s delay for Google to process
            }
        };

        if (images.length === 0) {
            container.className = 'content';
            container.innerHTML = `
                <div class="section-header">
                    <h2>🖼️ Image Gallery</h2>
                </div>
                <div class="empty-state">
                    <span class="empty-state-icon">🖼️</span>
                    <h2>No Images Yet</h2>
                    <p class="text-secondary">Upload images to Google Photos to see them here.</p>
                    <button id="gallery-empty-upload" class="btn-primary" style="margin-top:1rem;">📷 Add Images</button>
                </div>`;
            const galleryInput = document.createElement('input');
            galleryInput.type = 'file'; galleryInput.accept = 'image/*';
            galleryInput.multiple = true; galleryInput.style.display = 'none';
            container.appendChild(galleryInput);
            container.querySelector('#gallery-empty-upload').onclick = () => galleryInput.click();
            galleryInput.onchange = (e) => handleUpload(Array.from(e.target.files));
            return;
        }

        // ── Read view mode preference ──
        const GAL_MODE_KEY = 'galleryViewMode';
        let viewMode = localStorage.getItem(GAL_MODE_KEY) || 'feed'; // 'feed' or 'grid'

        // ── Floating buttons ──
        const shuffleBtn = document.createElement('button');
        shuffleBtn.className = 'feed-shuffle-btn';
        shuffleBtn.innerHTML = '🔀';
        shuffleBtn.title = 'Shuffle';
        shuffleBtn.onclick = () => {
            UI.renderGallery(container);
            Toast.show('Gallery shuffled! 🔀');
        };
        container.appendChild(shuffleBtn);

        // ── Slideshow button ──
        const galSlideshowBtn = document.createElement('button');
        galSlideshowBtn.className = 'slideshow-float-btn';
        galSlideshowBtn.innerHTML = '▶';
        galSlideshowBtn.title = 'Slideshow';
        container.appendChild(galSlideshowBtn);
        galSlideshowBtn.onclick = () => {
            const items = images.map(img => ({ type: 'image', data: img }));
            UI._openSlideshow(items, container);
        };

        // ── View mode toggle ──
        const viewToggleBtn = document.createElement('button');
        viewToggleBtn.className = 'view-toggle-btn';
        viewToggleBtn.title = viewMode === 'grid' ? 'Switch to Feed' : 'Switch to Grid';
        viewToggleBtn.innerHTML = viewMode === 'grid' ? '☰' : '⊞';
        viewToggleBtn.onclick = () => {
            viewMode = viewMode === 'grid' ? 'feed' : 'grid';
            localStorage.setItem(GAL_MODE_KEY, viewMode);
            renderGalleryView();
        };
        container.appendChild(viewToggleBtn);

        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'gallery-float-upload';
        uploadBtn.innerHTML = '📷';
        uploadBtn.title = 'Add Images';
        container.appendChild(uploadBtn);

        const galleryInput = document.createElement('input');
        galleryInput.type = 'file'; galleryInput.accept = 'image/*';
        galleryInput.multiple = true; galleryInput.style.display = 'none';
        container.appendChild(galleryInput);
        uploadBtn.onclick = () => galleryInput.click();
        galleryInput.onchange = (e) => {
            handleUpload(Array.from(e.target.files));
            galleryInput.value = '';
        };

        // Count badge
        const countBadge = document.createElement('div');
        countBadge.className = 'feed-count-badge';
        countBadge.textContent = `${images.length} photos`;
        container.appendChild(countBadge);

        // ── Container for swappable view ──
        const viewContainer = document.createElement('div');
        viewContainer.className = 'gallery-view-container';
        container.appendChild(viewContainer);

        const renderGalleryView = () => {
            viewContainer.innerHTML = '';
            viewToggleBtn.innerHTML = viewMode === 'grid' ? '☰' : '⊞';
            viewToggleBtn.title = viewMode === 'grid' ? 'Switch to Feed' : 'Switch to Grid';
            if (viewMode === 'grid') {
                renderGridView();
            } else {
                renderFeedView();
            }
        };

        // ─── GRID VIEW (date-grouped) ───────────────────────────────────────────────────
        const renderGridView = () => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'width:100%;padding-bottom:8px;';
            viewContainer.appendChild(wrapper);

            // Preload first batch
            Cache.preloadImageURLs(images.slice(0, 24).map(img => Gallery.getImageURL(img, 540)));

            // Group by month-year (features 14 + 15)
            const groups = new Map();
            images.forEach((image, i) => {
                const d = image.mediaMetadata?.creationTime
                    ? new Date(image.mediaMetadata.creationTime)
                    : null;
                const key = d
                    ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
                    : 'Unknown date';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push({ image, i });
            });

            groups.forEach((group, monthLabel) => {
                // Date separator header (feature 15)
                const header = document.createElement('div');
                header.className = 'photo-grid-date-header';
                header.textContent = monthLabel;
                wrapper.appendChild(header);

                const grid = document.createElement('div');
                grid.className = 'photo-grid';
                wrapper.appendChild(grid);

                group.forEach(({ image, i }) => {
                    const cell = document.createElement('div');
                    cell.className = 'photo-grid-cell';

                    const img = document.createElement('img');
                    img.src = Gallery.getImageURL(image, 540);
                    img.alt = image.filename || 'Photo';
                    img.loading = i < 12 ? 'eager' : 'lazy';
                    img.decoding = 'async';
                    img.draggable = false;
                    cell.appendChild(img);

                    const overlay = document.createElement('div');
                    overlay.className = 'photo-grid-overlay';
                    overlay.innerHTML = `<button class="photo-grid-edit-btn" title="AI Retouch">🪄</button>`;
                    overlay.querySelector('.photo-grid-edit-btn').onclick = (e) => {
                        e.stopPropagation();
                        FaceEditor.open(image);
                    };
                    cell.appendChild(overlay);

                    cell.onclick = (e) => {
                        if (e.target.closest('.photo-grid-edit-btn')) return;
                        const items = images.map(img => ({ type: 'image', data: img }));
                        UI._openSlideshow(items, container, i);
                    };

                    grid.appendChild(cell);
                });

                // Cache-ahead observer per grid
                const gridObs = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) return;
                        const ci = Array.from(grid.children).indexOf(entry.target);
                        if (ci >= 0) Cache.preloadImageURLs(
                            images.slice(ci, ci + 12).map(img => Gallery.getImageURL(img, 1080))
                        );
                    });
                }, { threshold: 0.1 });
                Array.from(grid.children).forEach(el => gridObs.observe(el));
            });
        };

        // ─── FEED VIEW (TikTok-style) ────────────────────────────────────────────
        const renderFeedView = () => {
            const feed = document.createElement('div');
            feed.className = 'video-feed';
            viewContainer.appendChild(feed);

            const createImageCard = (image, index) => {
                const card = document.createElement('div');
                card.className = 'video-card-feed gallery-card';
                card.dataset.idx = index;

                const imgContainer = document.createElement('div');
                imgContainer.className = 'gallery-img-container';

                const img = document.createElement('img');
                img.src = Gallery.getImageURL(image);
                img.alt = image.filename || 'Image';
                img.draggable = false;
                img.loading = 'lazy';
                img.decoding = 'async';

                // Detect portrait from metadata
                const meta = image.mediaMetadata || {};
                const w = parseInt(meta.width) || 0;
                const h = parseInt(meta.height) || 0;
                if (h > w * 1.2) {
                    card.classList.add('portrait');
                    img.classList.add('gallery-img-portrait');
                } else {
                    img.classList.add('gallery-img-landscape');
                }

                imgContainer.appendChild(img);
                card.appendChild(imgContainer);

                // Info overlay
                const info = document.createElement('div');
                info.className = 'feed-info-overlay';
                info.innerHTML = `<h3>${image.filename || 'Image'}</h3>`;
                card.appendChild(info);

                const actions = document.createElement('div');
                actions.className = 'feed-actions';
                actions.innerHTML = `
                <button class="btn-icon edit-btn" title="AI Retouch">🪄</button>
            `;
                actions.querySelector('.edit-btn').onclick = (e) => {
                    e.stopPropagation();
                    FaceEditor.open(image);
                };
                card.appendChild(actions);

                return card;
            };

            const CLONE_COUNT = Math.min(3, images.length);
            images.forEach((image, i) => feed.appendChild(createImageCard(image, i)));

            // ── Infinite Loop clones ──
            for (let i = 0; i < CLONE_COUNT; i++) {
                const clone = createImageCard(images[i], `clone-end-${i}`);
                clone.classList.add('gallery-clone'); feed.appendChild(clone);
            }
            for (let i = CLONE_COUNT - 1; i >= 0; i--) {
                const srcIdx = images.length - 1 - i;
                if (srcIdx >= 0) {
                    const clone = createImageCard(images[srcIdx], `clone-start-${i}`);
                    clone.classList.add('gallery-clone'); feed.insertBefore(clone, feed.firstChild);
                }
            }

            requestAnimationFrame(() => {
                const firstReal = feed.children[CLONE_COUNT];
                if (firstReal) feed.scrollTop = firstReal.offsetTop;
            });

            // Infinite scroll wrapping
            let scrolling = false;
            feed.addEventListener('scrollend', () => {
                if (scrolling) return;
                scrolling = true;
                const firstRealTop = feed.children[CLONE_COUNT]?.offsetTop || 0;
                const lastRealBottom = feed.children[CLONE_COUNT + images.length - 1];
                const cardHeight = feed.children[0]?.offsetHeight || window.innerHeight;
                const scrollTop = feed.scrollTop;
                if (lastRealBottom && scrollTop >= lastRealBottom.offsetTop + cardHeight * 0.5) {
                    feed.style.scrollBehavior = 'auto'; feed.scrollTop = firstRealTop; feed.style.scrollBehavior = '';
                } else if (scrollTop < firstRealTop - cardHeight * 0.5) {
                    feed.style.scrollBehavior = 'auto'; feed.scrollTop = lastRealBottom ? lastRealBottom.offsetTop : firstRealTop; feed.style.scrollBehavior = '';
                }
                scrolling = false;
            });
            let scrollTimer;
            feed.addEventListener('scroll', () => {
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => feed.dispatchEvent(new Event('scrollend')), 150);
            });

            // Update counter on scroll
            const feedObs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const idx = entry.target.dataset.idx;
                        if (idx && !String(idx).startsWith('clone')) {
                            countBadge.textContent = `${parseInt(idx) + 1} / ${images.length} photos`;
                            Cache.preloadAround(images, parseInt(idx), (item, w) => Gallery.getImageURL(item, w));
                        }
                    }
                });
            }, { root: feed, threshold: 0.6 });
            Array.from(feed.children).forEach(card => feedObs.observe(card));
        }; // end renderFeedView

        renderGalleryView();
        HypnoPopups.attach(container);
        Cache.preloadAround(images, 0, (item, w) => Gallery.getImageURL(item, w));
        UI._prefetchMedia(images, 0, 20);
    },

    renderProfile: async (container) => {
        container.appendChild(Loader());

        try {
            const user = await API.getUserInfo();
            Store.set('user', user);

            container.innerHTML = '';
            const profileWrapper = document.createElement('div');

            // ── Tab bar ──
            const tabBar = document.createElement('div');
            tabBar.className = 'profile-tabs';
            tabBar.innerHTML = `
                <button class="profile-tab active" data-tab="profile">👤 Profile</button>
                <button class="profile-tab" data-tab="settings">⚙️ Settings</button>
            `;
            profileWrapper.appendChild(tabBar);

            const tabContent = document.createElement('div');
            tabContent.className = 'profile-tab-content';
            profileWrapper.appendChild(tabContent);
            container.appendChild(profileWrapper);

            const showTab = (tab) => {
                tabBar.querySelectorAll('.profile-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
                tabContent.innerHTML = '';
                if (tab === 'profile') renderProfileTab();
                else renderSettingsTab();
            };
            tabBar.querySelectorAll('.profile-tab').forEach(btn => btn.onclick = () => showTab(btn.dataset.tab));

            const profile = document.createElement('div');
            profile.className = 'profile-container';

            const galleryCount = Gallery.count();
            const videoCount = Store.get('videos').length;
            const stats = {
                videos: videoCount,
                likes: (Store.get('likes') || []).length,
                mix: videoCount + galleryCount,
                gallery: galleryCount
            };

            const renderProfileTab = () => {

                // ────── The existing profile HTML content as-was ──────
                profile.innerHTML = `
                <div class="profile-header">
                    <div class="profile-avatar">
                        ${user.picture
                        ? `<img src="${user.picture}" alt="${user.name}" referrerpolicy="no-referrer">`
                        : `<div class="profile-avatar-placeholder">${(user.name || 'U').charAt(0).toUpperCase()}</div>`
                    }
                    </div>
                    <div class="profile-details">
                        <h1>${user.name || 'User'}</h1>
                        <p class="text-secondary">${user.email || ''}</p>
                    </div>
                </div>

                <div class="profile-stats">
                    <div class="stat-card">
                        <span class="stat-icon">📹</span>
                        <span class="stat-value">${stats.videos}</span>
                        <span class="stat-label">Videos</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon">❤️</span>
                        <span class="stat-value">${stats.likes}</span>
                        <span class="stat-label">Liked</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon">🔀</span>
                        <span class="stat-value">${stats.mix}</span>
                        <span class="stat-label">Mix</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon">🖼️</span>
                        <span class="stat-value">${stats.gallery}</span>
                        <span class="stat-label">Gallery</span>
                    </div>
                </div>


                <div class="profile-actions">
                    <button id="profile-hypno-settings" class="btn-secondary" style="margin-right:10px">⚙️ Hypno Settings</button>
                    <button id="profile-logout" class="btn-primary">Sign Out</button>
                </div>
            `;

                profile.querySelector('#profile-logout').onclick = () => Auth.logout();

                profile.querySelector('#profile-hypno-settings').onclick = () => {
                    const config = getConfig();
                    const container = document.createElement('div');
                    container.style.padding = '10px';

                    // Effect definitions with icons, descriptions, and preview CSS — 46 effects in 5 categories
                    const effects = {
                        'Visual / Chill 👁️': [
                            { key: 'scanlines', icon: '📺', desc: 'CRT scanlines overlay', preview: 'background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.3) 2px,rgba(0,0,0,0.3) 4px);' },
                            { key: 'rgbShift', icon: '🌈', desc: 'RGB color split', preview: 'box-shadow:2px 0 #f0f,-2px 0 #0ff;' },
                            { key: 'pixelate', icon: '🟩', desc: 'Pixel mosaic effect', preview: 'image-rendering:pixelated;background-size:8px 8px;background-image:repeating-conic-gradient(#333 0% 25%,#555 0% 50%);' },
                            { key: 'textSubliminal', icon: '👁️', desc: 'Flash hidden words', preview: '' },
                            { key: 'breathe', icon: '🫁', desc: 'Breathing pulse', preview: 'animation:hypnoPreviewBreathe 2s ease-in-out infinite;' },
                            { key: 'tilt', icon: '📐', desc: 'Subtle tilt shifts', preview: 'transform:rotate(3deg);' },
                            { key: 'mirror', icon: '🪞', desc: 'Mirror flip axis', preview: 'transform:scaleX(-1);' },
                            { key: 'colorCycle', icon: '🎡', desc: 'Hue rotation cycle', preview: 'animation:hypnoPreviewHue 2s linear infinite;' },
                            { key: 'fadePulse', icon: '💫', desc: 'Opacity oscillation', preview: 'animation:hypnoFadePulse 1.5s ease-in-out infinite;' },
                            { key: 'filmGrain', icon: '🎞️', desc: 'Film grain overlay', preview: 'background:repeating-conic-gradient(#333 0% 25%,#444 0% 50%);background-size:4px 4px;' },
                            { key: 'sepiaFlash', icon: '📜', desc: 'Quick sepia flash', preview: 'filter:sepia(1);' }
                        ],
                        'Motion / Transform 🌊': [
                            { key: 'doubleVision', icon: '👓', desc: 'Double vision ghost', preview: 'box-shadow:3px 3px 0 rgba(255,100,100,0.5),-3px -3px 0 rgba(100,100,255,0.5);' },
                            { key: 'verticalStretch', icon: '↕️', desc: 'Screen stretch warp', preview: 'transform:scaleY(1.3);' },
                            { key: 'glitch', icon: '⚡', desc: 'Screen glitch bursts', preview: 'animation:hypnoPreviewGlitch 0.3s infinite;' },
                            { key: 'zoomPulse', icon: '🔍', desc: 'Zoom in/out pulse', preview: 'animation:hypnoPreviewBreathe 1s ease-in-out infinite;' },
                            { key: 'skewHorizontal', icon: '↗️', desc: 'Horizontal skew', preview: 'transform:skewX(8deg);' },
                            { key: 'skewVertical', icon: '↘️', desc: 'Vertical skew', preview: 'transform:skewY(5deg);' },
                            { key: 'wobble', icon: '〰️', desc: 'Sine-wave wobble', preview: 'animation:hypnoPreviewGlitch 0.5s ease-in-out infinite;' },
                            { key: 'heartbeat', icon: '💓', desc: 'Heartbeat pulse', preview: 'animation:hypnoPreviewBreathe 0.6s ease-in-out infinite;' },
                            { key: 'earthquake', icon: '🌋', desc: 'Heavy screen shake', preview: 'animation:hypnoPreviewGlitch 0.1s linear infinite;' },
                            { key: 'drunkMode', icon: '🍺', desc: 'Dizzy blur + sway', preview: 'filter:blur(1px);transform:rotate(2deg) skewX(3deg);' }
                        ],
                        'Color / Filter 🎨': [
                            { key: 'negativeFlash', icon: '🔳', desc: 'Brief color invert', preview: 'filter:invert(1);' },
                            { key: 'thermalVision', icon: '🌡️', desc: 'Thermal camera look', preview: 'filter:hue-rotate(180deg) contrast(2) saturate(3);' },
                            { key: 'nightVision', icon: '🌙', desc: 'Green night vision', preview: 'filter:sepia(1) hue-rotate(80deg) saturate(4) brightness(1.5);' },
                            { key: 'redChannel', icon: '🟥', desc: 'Red channel only', preview: 'filter:sepia(1) hue-rotate(-30deg) saturate(3);' },
                            { key: 'blueChannel', icon: '🟦', desc: 'Blue channel only', preview: 'filter:sepia(1) hue-rotate(180deg) saturate(3);' },
                            { key: 'greenChannel', icon: '🟩', desc: 'Green channel only', preview: 'filter:sepia(1) hue-rotate(80deg) saturate(3);' },
                            { key: 'solarize', icon: '☀️', desc: 'Partial invert', preview: 'filter:invert(0.8) contrast(1.5);' },
                            { key: 'colorDrain', icon: '🩶', desc: 'Desaturate pulse', preview: 'filter:saturate(0);' },
                            { key: 'cyberpunk', icon: '🤖', desc: 'Neon color cycling', preview: 'animation:hypnoPreviewHue 1s linear infinite;filter:saturate(2);' },
                            { key: 'bloodMoon', icon: '🩸', desc: 'Deep red overlay', preview: 'filter:sepia(1) hue-rotate(-20deg) saturate(5) brightness(0.7);' },
                            { key: 'retroWave', icon: '🌆', desc: 'Synthwave palette', preview: 'background:linear-gradient(135deg,#c864ff,#0ff);' }
                        ],
                        'Overlay / Complex 🎭': [
                            { key: 'tunnel', icon: '🌀', desc: 'Tunnel vortex overlay', preview: 'background:radial-gradient(circle,transparent 30%,rgba(0,0,0,0.8) 100%);' },
                            { key: 'strobe', icon: '💡', desc: 'Flash strobe', preview: 'animation:hypnoPreviewStrobe 0.5s infinite;' },
                            { key: 'hologram', icon: '🔮', desc: 'Hologram flicker', preview: 'box-shadow:2px 0 #0ff,-2px 0 #f0f;animation:hypnoPreviewStrobe 0.15s steps(2) infinite;' },
                            { key: 'oldTV', icon: '📟', desc: 'Old TV jitter', preview: 'animation:hypnoPreviewGlitch 0.08s steps(3) infinite;' },
                            { key: 'subliminalFlash', icon: '⚡', desc: 'Bright white flash', preview: 'background:#fff;' },
                            { key: 'matrixRain', icon: '🟢', desc: 'Matrix code rain', preview: 'background:#000;color:#0f0;font-size:8px;overflow:hidden;line-height:1;' },
                            { key: 'speedLines', icon: '💨', desc: 'Radial speed lines', preview: 'background:repeating-conic-gradient(transparent 0deg,transparent 8deg,rgba(255,255,255,0.05) 8deg,rgba(255,255,255,0.05) 10deg);' },
                            { key: 'datamosh', icon: '📼', desc: 'Data corruption', preview: 'background:linear-gradient(0deg,#333 25%,transparent 25%,transparent 50%,#444 50%,#444 75%,transparent 75%);background-size:100% 8px;' },
                            { key: 'ghostTrail', icon: '👻', desc: 'Afterimage trail', preview: 'box-shadow:3px 3px 8px rgba(200,100,255,0.4),-3px -3px 8px rgba(100,200,255,0.4);' },
                            { key: 'fishEye', icon: '🐟', desc: 'Fish eye lens', preview: 'border-radius:50%;transform:scale(1.1);' }
                        ],
                        'Extreme ⚠️': [
                            { key: 'kaleidoscope', icon: '🔮', desc: 'Kaleidoscope fractal', preview: 'background:conic-gradient(from 0deg,#f0f,#0ff,#ff0,#f0f);' },
                            { key: 'liquidWarp', icon: '🌊', desc: 'Liquid distortion', preview: 'animation:hypnoPreviewLiquid 2s ease-in-out infinite;border-radius:30% 70% 70% 30% / 30% 30% 70% 70%;' },
                            { key: 'vortex', icon: '🌪️', desc: 'Spin vortex (motion!)', preview: 'animation:hypnoPreviewVortex 2s linear infinite;' },
                            { key: 'blackout', icon: '⬛', desc: 'Random blackouts', preview: 'background:#000;' },
                            { key: 'whiteout', icon: '⬜', desc: 'Blinding white flash', preview: 'background:#fff;' },
                            { key: 'chromaStorm', icon: '🌈', desc: 'Crazy color storm', preview: 'animation:hypnoPreviewHue 0.3s linear infinite;filter:saturate(5);' }
                        ]
                    };

                    for (const [title, items] of Object.entries(effects)) {
                        const h3 = document.createElement('h3');
                        h3.textContent = title;
                        h3.style.cssText = 'color:var(--text-secondary);font-size:0.85rem;margin:18px 0 10px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px;';
                        container.appendChild(h3);

                        const grid = document.createElement('div');
                        grid.className = 'hypno-effects-grid';

                        items.forEach(effect => {
                            const card = document.createElement('div');
                            card.className = 'hypno-effect-card' + (config[effect.key] !== false ? ' active' : '');

                            // Preview box
                            const previewBox = document.createElement('div');
                            previewBox.className = 'hypno-preview-box';
                            if (effect.preview) {
                                previewBox.style.cssText = effect.preview;
                            }
                            // Subliminal text special preview
                            if (effect.key === 'textSubliminal') {
                                previewBox.className += ' hypno-preview-text';
                                previewBox.innerHTML = '<span>OBEY</span>';
                            }

                            // Info
                            const info = document.createElement('div');
                            info.className = 'hypno-effect-info';
                            info.innerHTML = `
                            <div class="hypno-effect-name">${effect.icon} ${effect.key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div>
                            <div class="hypno-effect-desc">${effect.desc}</div>
                        `;

                            // Toggle switch
                            const toggle = document.createElement('label');
                            toggle.className = 'hypno-toggle-switch';
                            toggle.innerHTML = `<input type="checkbox" ${config[effect.key] !== false ? 'checked' : ''}><span class="hypno-slider"></span>`;
                            toggle.querySelector('input').onchange = (e) => {
                                updateConfig({ [effect.key]: e.target.checked });
                                card.classList.toggle('active', e.target.checked);
                            };

                            card.appendChild(previewBox);
                            card.appendChild(info);
                            card.appendChild(toggle);
                            grid.appendChild(card);
                        });
                        container.appendChild(grid);
                    }

                    const modal = Modal('🌀 Hypno Configuration', '');
                    const body = modal.querySelector('.modal-body');
                    body.innerHTML = '';
                    body.appendChild(container);
                    modal.querySelector('.modal-content').classList.add('hypno-config-modal');
                    document.body.appendChild(modal);
                };

                tabContent.appendChild(profile);
            }; // end renderProfileTab

            // ── Settings Tab (nav visibility) ─────────────────────────────────────
            const renderSettingsTab = () => {
                const settingsDiv = document.createElement('div');
                settingsDiv.className = 'settings-container';

                const visibleKeys = getVisibleItems().map(i => i.key);

                settingsDiv.innerHTML = `
                    <h2 class="settings-title">⚙️ Navigation Settings</h2>
                    <p class="settings-desc">Choose which pages appear in your navigation bar.</p>
                    <div class="settings-nav-grid">
                        ${ALL_NAV_ITEMS.map(item => `
                            <label class="settings-nav-item ${visibleKeys.includes(item.key) ? 'enabled' : ''}"
                                   data-key="${item.key}"
                                   title="${item.label === 'Home' || item.label === 'Profile' ? 'Always visible' : ''}">
                                <span class="settings-nav-icon">${item.icon}</span>
                                <span class="settings-nav-label">${item.label}</span>
                                <input type="checkbox"
                                    ${visibleKeys.includes(item.key) ? 'checked' : ''}
                                    ${item.key === 'home' || item.key === 'profile' ? 'disabled' : ''}>
                                <span class="settings-nav-check"></span>
                            </label>
                        `).join('')}
                    </div>
                    <button class="btn-primary settings-save-btn" style="margin-top:20px;width:100%">✓ Apply Changes</button>
                    <div class="settings-section-sep"></div>
                    <h2 class="settings-title">🖼️ Offline Cache</h2>
                    <p class="settings-desc">Clear cached media thumbnails to free up storage.</p>
                    <button class="btn-secondary settings-clear-cache-btn" style="width:100%">🗑️ Clear Media Cache</button>
                `;

                // Apply changes
                settingsDiv.querySelector('.settings-save-btn').onclick = () => {
                    const checked = [...settingsDiv.querySelectorAll('input[type=checkbox]:checked:not(:disabled)')]
                        .map(cb => cb.closest('[data-key]').dataset.key);
                    setVisibleItems(checked);
                    Toast.show('✓ Navigation updated!', 'success');
                };

                // Toggle highlight
                settingsDiv.querySelectorAll('.settings-nav-item').forEach(label => {
                    const cb = label.querySelector('input');
                    if (cb.disabled) return;
                    cb.onchange = () => label.classList.toggle('enabled', cb.checked);
                });

                // Clear cache
                settingsDiv.querySelector('.settings-clear-cache-btn').onclick = () => {
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_MEDIA_CACHE' });
                        Toast.show('Media cache cleared', 'success');
                    } else {
                        Toast.show('Cache already empty or SW not active', 'info');
                    }
                };

                tabContent.appendChild(settingsDiv);
            };

            showTab('profile');

        } catch (error) {
            console.error(error);
            container.innerHTML = `
                <div class="profile-container">
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <div class="profile-avatar-placeholder">U</div>
                        </div>
                        <div class="profile-details">
                            <h1>Signed In</h1>
                            <p class="text-secondary">Could not fetch profile details.</p>
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button id="profile-logout" class="btn-primary">Sign Out</button>
                    </div>
                </div>`;
            container.querySelector('#profile-logout').onclick = () => Auth.logout();
        }
    },

    renderSearch: async (container, query) => {
        container.innerHTML = `
            <div class="section-header">
                <h2>Search results for "${query}"</h2>
            </div>
        `;
        container.appendChild(Loader());

        try {
            // First try to filter from cached videos
            let videos = Store.get('videos').filter(v =>
                v.filename.toLowerCase().includes(query.toLowerCase())
            );

            // If nothing found locally, try API
            if (videos.length === 0) {
                const data = await API.searchByFilename(query);
                if (data && data.mediaItems) {
                    videos = data.mediaItems.filter(item => item.mediaMetadata.video);
                }
            }

            // Remove loader
            const loader = container.querySelector('.loader-container');
            if (loader) loader.remove();

            if (videos.length === 0) {
                container.innerHTML += `
                    <div class="empty-state">
                        <span class="empty-state-icon">🔍</span>
                        <h2>No Results</h2>
                        <p class="text-secondary">No videos found matching "${query}".</p>
                    </div>`;
                return;
            }

            const grid = document.createElement('div');
            grid.className = 'video-grid';

            videos.forEach(video => {
                grid.appendChild(VideoCard(video));
            });

            container.appendChild(grid);

        } catch (error) {
            console.error(error);
            const loader = container.querySelector('.loader-container');
            if (loader) loader.remove();
            container.innerHTML += `<p class="text-secondary">Error searching: ${error.message}</p>`;
            Toast.show('Search failed', 'error');
        }
    },

    // ── #14 Watch History Page ──
    renderHistory: (container) => {
        const history = History.getHistory();
        container.innerHTML = `
            <div class="section-header">
                <h2>🕐 Watch History</h2>
                <div style="display:flex;gap:10px;align-items:center;">
                    <span class="text-secondary">${history.length} video${history.length !== 1 ? 's' : ''}</span>
                    <button id="clear-history" class="btn-secondary" style="font-size:0.8rem;">Clear All</button>
                </div>
            </div>
        `;
        container.querySelector('#clear-history').onclick = () => {
            History.clearHistory();
            UI.renderHistory(container);
            Toast.show('History cleared', 'success');
        };

        if (history.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <span class="empty-state-icon">🕐</span>
                    <h2>No Watch History</h2>
                    <p class="text-secondary">Videos you watch will appear here.</p>
                </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'video-grid';
        history.forEach(video => {
            const card = VideoCard(video);
            // Show when watched
            const badge = document.createElement('div');
            badge.className = 'quality-badge';
            badge.style.cssText = 'background:rgba(0,0,0,0.7);color:var(--text-secondary);';
            badge.textContent = UI.timeAgo(video.watchedAt);
            card.style.position = 'relative';
            card.appendChild(badge);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    },

    // ── #40 Stats Dashboard ──
    renderStats: (container) => {
        const history = History.getHistory();
        const likes = Likes.getLikes();
        const videos = Store.get('videos') || [];

        // Calculate stats
        const totalWatched = history.length;
        const totalLiked = likes.length;
        const totalVideos = videos.length;
        const totalNotes = Object.keys(localStorage).filter(k => k.startsWith('video_notes_')).length;

        // Watch activity by day of week
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        history.forEach(h => {
            if (h.watchedAt) dayCounts[new Date(h.watchedAt).getDay()]++;
        });
        const maxDay = Math.max(...dayCounts, 1);

        container.innerHTML = `
            <div class="section-header">
                <h2>📊 Your Statistics</h2>
                <span class="text-secondary">Viewing activity</span>
            </div>

            <div class="stats-grid">
                <div class="stats-big-card">
                    <div class="stats-big-value">${totalVideos}</div>
                    <div class="stats-big-label">Videos in Library</div>
                </div>
                <div class="stats-big-card">
                    <div class="stats-big-value">${totalWatched}</div>
                    <div class="stats-big-label">Videos Watched</div>
                </div>
                <div class="stats-big-card">
                    <div class="stats-big-value">${totalLiked}</div>
                    <div class="stats-big-label">Liked Videos</div>
                </div>
                <div class="stats-big-card">
                    <div class="stats-big-value">${totalNotes}</div>
                    <div class="stats-big-label">Video Notes</div>
                </div>
            </div>

            <div class="stats-chart-container">
                <h3 style="margin-bottom:1rem;font-size:0.95rem;">📅 Watch Activity by Day</h3>
                <div class="stats-bar-chart">
                    ${dayCounts.map((count, i) => `
                        <div style="flex:1;text-align:center;">
                            <div class="stats-bar" style="height:${Math.max(4, (count / maxDay) * 100)}%;" title="${count} videos"></div>
                            <div class="stats-bar-label">${dayNames[i]}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="stats-chart-container">
                <h3 style="margin-bottom:1rem;font-size:0.95rem;">🎯 Recent Activity</h3>
                <div style="max-height:250px;overflow-y:auto;">
                ${history.slice(0, 15).map(h => `
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:0.9rem;">
                        <a href="#/video?id=${h.id}" style="color:var(--text-color);max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.filename}</a>
                        <span style="color:var(--text-secondary);font-size:0.8rem;">${UI.timeAgo(h.watchedAt)}</span>
                    </div>
                `).join('')}
                ${history.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-secondary);">No activity yet</div>' : ''}
                </div>
            </div>
        `;
    },

    // ---- Helpers ----

    timeAgo: (dateString) => {
        const now = new Date();
        const date = new Date(dateString);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    },

    // ── Slideshow Controller ─────────────────────────────────────────────────
    _openSlideshow: (items, parentContainer, startIndex = 0) => {
        document.querySelector('.slideshow-overlay')?.remove();

        const STORAGE_KEY_DUR = 'slideshowImageDuration';
        const STORAGE_KEY_TRANS = 'slideshowTransition';
        const STORAGE_KEY_SURPRISE = 'slideshowSurprise';
        let imageDuration = parseInt(localStorage.getItem(STORAGE_KEY_DUR) || '5000', 10);
        let transition = localStorage.getItem(STORAGE_KEY_TRANS) || 'fade';
        let surpriseMode = localStorage.getItem(STORAGE_KEY_SURPRISE) === 'true';
        // Feature 26: live photo filters
        const PHOTO_FILTERS = [
            { label: 'Normal', css: 'none' },
            { label: 'B&W', css: 'grayscale(1)' },
            { label: 'Sépia', css: 'sepia(1)' },
            { label: 'Vivid', css: 'saturate(2.2) contrast(1.1)' },
            { label: 'Doux', css: 'brightness(1.1) contrast(0.9) saturate(0.8)' },
        ];
        let filterIdx = 0;

        const overlay = document.createElement('div');
        overlay.className = 'slideshow-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="slideshow-inner">
                <div class="slideshow-media-area">
                    <div class="slideshow-media-wrap" id="ss-media-wrap"></div>
                    <div class="slideshow-progress-bar"><div class="slideshow-progress-fill" id="ss-progress"></div></div>
                </div>
                <div class="slideshow-controls">
                    <button class="ss-btn" id="ss-prev" aria-label="Previous">&#8249;</button>
                    <button class="ss-btn ss-play-pause" id="ss-play" aria-label="Pause">&#9646;&#9646;</button>
                    <button class="ss-btn" id="ss-next" aria-label="Next">&#8250;</button>
                    <div class="ss-timer-wrap" id="ss-timer-section">
                        <span class="ss-timer-label">⏱ Timer</span>
                        <div class="ss-timer-options">
                            <button class="ss-timer-btn${imageDuration === 200 ? ' active' : ''}">0.2s</button>
                            <button class="ss-timer-btn${imageDuration === 500 ? ' active' : ''}">0.5s</button>
                            <button class="ss-timer-btn${imageDuration === 1000 ? ' active' : ''}">1s</button>
                            <button class="ss-timer-btn${imageDuration === 5000 ? ' active' : ''}">5s</button>
                        </div>
                    </div>
                    <div class="ss-timer-wrap">
                        <span class="ss-timer-label">🌀 Transition</span>
                        <div class="ss-timer-options" id="ss-trans-opts">
                            ${['fade', 'slide', 'zoom', 'flip'].map(t =>
            `<button class="ss-timer-btn${transition === t ? ' active' : ''}" data-trans="${t}">${t}</button>`
        ).join('')}
                        </div>
                    </div>
                    <div class="ss-timer-wrap">
                        <span class="ss-timer-label">🎨 Filter</span>
                        <div class="ss-timer-options" id="ss-filter-opts">
                            ${PHOTO_FILTERS.map((f, i) =>
            `<button class="ss-timer-btn${i === 0 ? ' active' : ''}" data-fi="${i}">${f.label}</button>`
        ).join('')}
                        </div>
                    </div>
                    <button class="ss-btn ss-surprise-btn${surpriseMode ? ' active' : ''}" id="ss-surprise" title="Surprise Mode">&#128591;</button>
                    <button class="ss-btn ss-close-btn" id="ss-close" aria-label="Close">✕</button>
                </div>
                <div class="slideshow-counter" id="ss-counter"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        let currentIdx = startIndex;
        let isPlaying = true;
        let timer = null;
        let progressRaf = null;
        let progressStart = null;
        let activeVideoEl = null;

        const mediaWrap = overlay.querySelector('#ss-media-wrap');
        const progressFill = overlay.querySelector('#ss-progress');
        const counter = overlay.querySelector('#ss-counter');
        const playBtn = overlay.querySelector('#ss-play');
        const timerSection = overlay.querySelector('#ss-timer-section');

        // Feature 44: surprise mode hides timer and counter
        const applySurprise = () => {
            timerSection.style.display = surpriseMode ? 'none' : '';
            counter.style.display = surpriseMode ? 'none' : '';
            overlay.querySelector('#ss-progress').parentElement.style.opacity = surpriseMode ? '0' : '1';
        };
        applySurprise();

        const close = () => {
            clearTimeout(timer);
            cancelAnimationFrame(progressRaf);
            activeVideoEl?.pause();
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 350);
        };
        overlay.querySelector('#ss-close').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        const keyHandler = e => {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keyHandler); }
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        document.addEventListener('keydown', keyHandler);

        // Feature 41: transition animation between items
        const applyTransitionOut = (el) => {
            el.classList.add(`ss-trans-out-${transition}`);
        };
        const applyTransitionIn = (el) => {
            el.classList.add(`ss-trans-in-${transition}`);
        };

        const setProgress = (duration) => {
            cancelAnimationFrame(progressRaf);
            progressFill.style.width = '0%';
            progressStart = performance.now();
            const step = (now) => {
                const pct = Math.min(100, ((now - progressStart) / duration) * 100);
                progressFill.style.width = pct + '%';
                if (pct < 100) progressRaf = requestAnimationFrame(step);
            };
            if (isPlaying && !surpriseMode) progressRaf = requestAnimationFrame(step);
        };

        const showItem = (idx, skipTransition = false) => {
            clearTimeout(timer);
            cancelAnimationFrame(progressRaf);
            const oldWrap = mediaWrap.firstChild;
            if (oldWrap && !skipTransition) applyTransitionOut(oldWrap);

            activeVideoEl?.pause();
            activeVideoEl = null;

            const item = items[idx];
            if (!item) return;
            if (!surpriseMode) counter.textContent = `${idx + 1} / ${items.length}`;

            MediaStats.recordView(item.data.id);

            // Preload neighbours
            const mediaArr = items.map(i => i.data);
            Cache.preloadAround(mediaArr, idx, (med, w) =>
                med.mediaMetadata?.video ? `${med.baseUrl}=dv` : `${med.baseUrl}=w${w}`);

            const newWrap = document.createElement('div');
            newWrap.className = 'slideshow-media-wrap';
            newWrap.style.position = 'absolute';
            newWrap.style.inset = '0';
            newWrap.style.display = 'flex';
            newWrap.style.alignItems = 'center';
            newWrap.style.justifyContent = 'center';

            if (item.type === 'video') {
                const vid = document.createElement('video');
                vid.src = `${item.data.baseUrl}=dv`;
                vid.autoplay = true; vid.muted = false;
                vid.playsInline = true; vid.controls = false;
                vid.className = 'ss-video';
                newWrap.appendChild(vid);
                activeVideoEl = vid;
                vid.addEventListener('loadedmetadata', () => setProgress(vid.duration * 1000 || 10000));
                vid.addEventListener('ended', () => { if (isPlaying) setTimeout(next, 300); });
                vid.addEventListener('error', () => setTimeout(next, 1000));
                vid.play().catch(() => { });
            } else {
                const img = document.createElement('img');
                img.src = Gallery.getImageURL(item.data, 1080);
                img.alt = item.data.filename || 'Photo';
                img.className = 'ss-image';
                img.draggable = false;
                img.decoding = 'async';
                // Apply current filter (feature 26)
                if (PHOTO_FILTERS[filterIdx].css !== 'none') img.style.filter = PHOTO_FILTERS[filterIdx].css;
                newWrap.appendChild(img);
                setProgress(imageDuration);
                if (isPlaying) timer = setTimeout(next, imageDuration);
            }

            if (!skipTransition) applyTransitionIn(newWrap);
            const mediaArea = overlay.querySelector('.slideshow-media-area');
            // Remove old after transition
            if (oldWrap) setTimeout(() => { try { oldWrap.remove(); } catch { } }, 350);
            mediaArea.insertBefore(newWrap, mediaArea.querySelector('.slideshow-progress-bar'));
        };

        const next = () => { currentIdx = (currentIdx + 1) % items.length; showItem(currentIdx); };
        const prev = () => { currentIdx = (currentIdx - 1 + items.length) % items.length; showItem(currentIdx); };

        overlay.querySelector('#ss-prev').onclick = prev;
        overlay.querySelector('#ss-next').onclick = next;

        playBtn.onclick = () => {
            isPlaying = !isPlaying;
            playBtn.innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9654;';
            if (isPlaying) {
                const item = items[currentIdx];
                if (item?.type === 'video') activeVideoEl?.play();
                else { setProgress(imageDuration); timer = setTimeout(next, imageDuration); }
            } else {
                cancelAnimationFrame(progressRaf);
                clearTimeout(timer);
                activeVideoEl?.pause();
            }
        };

        // Timer buttons
        overlay.querySelectorAll('.ss-timer-btn').forEach(btn => {
            if (btn.dataset.trans) {
                btn.onclick = () => {
                    transition = btn.dataset.trans;
                    localStorage.setItem(STORAGE_KEY_TRANS, transition);
                    overlay.querySelectorAll('[data-trans]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                };
                return;
            }
            if (btn.dataset.fi !== undefined) {
                btn.onclick = () => {
                    filterIdx = parseInt(btn.dataset.fi);
                    overlay.querySelectorAll('[data-fi]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // Apply filter to current image
                    const imgEl = overlay.querySelector('.ss-image');
                    if (imgEl) imgEl.style.filter = PHOTO_FILTERS[filterIdx].css === 'none' ? '' : PHOTO_FILTERS[filterIdx].css;
                };
                return;
            }
            btn.onclick = () => {
                const dur = parseInt(btn.textContent) * 1000;
                imageDuration = dur;
                localStorage.setItem(STORAGE_KEY_DUR, String(dur));
                overlay.querySelectorAll('.ss-timer-btn:not([data-trans]):not([data-fi])').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (items[currentIdx]?.type !== 'video' && isPlaying) {
                    clearTimeout(timer); setProgress(dur); timer = setTimeout(next, dur);
                }
            };
        });

        // Surprise mode toggle (feature 44)
        overlay.querySelector('#ss-surprise').onclick = () => {
            surpriseMode = !surpriseMode;
            localStorage.setItem(STORAGE_KEY_SURPRISE, String(surpriseMode));
            overlay.querySelector('#ss-surprise').classList.toggle('active', surpriseMode);
            applySurprise();
        };

        // Touch swipe
        let touchStartX = 0, touchStartY = 0;
        overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: true });
        overlay.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
            if (dy > 60) return;
            if (dx < -40) next(); else if (dx > 40) prev();
        }, { passive: true });

        showItem(currentIdx, true);

    },

    // ── Prefetch next N media items — adaptive to connection ──
    _prefetchMedia: (items, startIdx = 0, count = 40) => {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const isSaveData = conn?.saveData === true;
        const isSlow = conn && ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
        const effectiveCount = isSaveData ? 0 : isSlow ? Math.min(count, 5) : count;
        if (effectiveCount === 0) return;

        document.querySelectorAll('link[data-prefetch]').forEach(l => l.remove());

        const end = Math.min(startIdx + effectiveCount, items.length);
        for (let i = startIdx; i < end; i++) {
            const item = items[i];
            if (!item || !item.baseUrl || item._isLocal) continue;
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.setAttribute('data-prefetch', 'media');
            if (item.mediaMetadata?.video) {
                link.as = 'video';
                link.href = `${item.baseUrl}=dv`;
            } else {
                link.as = 'image';
                link.href = `${item.baseUrl}=w${isSlow ? 720 : 1080}`;
            }
            document.head.appendChild(link);
        }
    }
};

export default UI;

