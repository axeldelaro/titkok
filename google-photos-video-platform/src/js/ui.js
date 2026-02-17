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
// PendingUploads removed — simple upload flow
import { Toast } from '../components/toast.js';
import Modal from '../components/modal.js';

const UI = {
    init: () => {
        const app = document.getElementById('app');

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
            // (only if ALL completed — don't disrupt playback in progress)
            if (successCount > 0) {
                // Wait a few seconds for Google to process, then refresh silently
                setTimeout(() => {
                    Store.set('videos', []);
                    Store.set('nextPageToken', null);
                    // Only refresh if still on home
                    if (window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#') {
                        const contentEl = document.getElementById('content');
                        if (contentEl) UI.renderHome(contentEl);
                    }
                }, 10000); // 10s delay to give Google some processing time
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
    },

    handleRoute: async (route) => {
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

    renderHome: async (container) => {
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

            // Shuffle button — floating on top of the feed
            const shuffleBtn = document.createElement('button');
            shuffleBtn.className = 'feed-shuffle-btn';
            shuffleBtn.innerHTML = '🔀';
            shuffleBtn.title = 'Shuffle';
            shuffleBtn.onclick = () => {
                // Fisher-Yates shuffle
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
                // Try top-level width/height first
                let w = parseInt(meta.width) || 0;
                let h = parseInt(meta.height) || 0;
                // Fallback: check inside mediaMetadata.video
                if ((!w || !h) && meta.video) {
                    w = parseInt(meta.video.width) || w;
                    h = parseInt(meta.video.height) || h;
                }
                return h > w && w > 0;
            };

            // Lazy-load observer — only activate visible videos
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const player = entry.target._player;
                    if (!player) return;
                    if (entry.isIntersecting) {
                        player.activate();
                    } else {
                        player.deactivate();
                    }
                });
            }, { root: null, threshold: 0.6 });

            // Helper: create and append a video card
            const createVideoCard = (video) => {
                const card = document.createElement('div');
                card.dataset.id = video.id;

                const isPortrait = isPortraitVideo(video);
                card.className = `video-card-feed${isPortrait ? ' portrait' : ''}`;

                const playerContainer = document.createElement('div');
                playerContainer.className = 'feed-player-container';
                const player = new Player(playerContainer, video.baseUrl, video.baseUrl, { lazy: true, mediaItemId: video.id });

                card._player = player;

                if (!isPortrait && player.video) {
                    player.video.addEventListener('loadedmetadata', () => {
                        if (player.video.videoHeight > player.video.videoWidth) {
                            card.classList.add('portrait');
                        }
                    });
                }

                // Info overlay
                const infoOverlay = document.createElement('div');
                infoOverlay.className = 'feed-info-overlay';
                infoOverlay.innerHTML = `<h3>${video.filename}</h3>`;

                // Action buttons
                const actions = document.createElement('div');
                actions.className = 'feed-actions';
                actions.innerHTML = `
                    <button class="btn-icon like-btn" title="Like">${Likes.isLiked(video.id) ? '❤️' : '🤍'}</button>
                    <button class="btn-icon share-btn" title="Copy Link">🔗</button>
                    <button class="btn-icon delete-btn" title="Remove from feed">🗑️</button>
                `;

                actions.querySelector('.like-btn').onclick = (e) => {
                    e.stopPropagation();
                    const isLiked = Likes.toggleLike(video);
                    e.currentTarget.textContent = isLiked ? '❤️' : '🤍';
                };

                actions.querySelector('.share-btn').onclick = (e) => {
                    e.stopPropagation();
                    if (video._isLocal) {
                        Toast.show('Link available after upload completes', 'info');
                        return;
                    }
                    navigator.clipboard.writeText(`${window.location.origin}/#/video?id=${video.id}`);
                    Toast.show('Link copied!');
                };

                actions.querySelector('.delete-btn').onclick = (e) => {
                    e.stopPropagation();
                    // Revoke blob URL to free memory
                    if (video._isLocal && video.baseUrl) {
                        try { URL.revokeObjectURL(video.baseUrl); } catch (ex) { }
                    }
                    Store.removeVideo(video.id);
                    card.remove();
                    Toast.show('Video removed from feed');
                };

                card.appendChild(playerContainer);
                card.appendChild(infoOverlay);
                card.appendChild(actions);
                feed.appendChild(card);
                observer.observe(card);
            };

            // Render all videos
            videos.forEach(video => createVideoCard(video));

            // Video count badge
            const countBadge = document.createElement('div');
            countBadge.className = 'feed-count-badge';
            countBadge.textContent = `${videos.length} videos`;
            container.appendChild(countBadge);

            container.appendChild(feed);

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

        // Share / Copy Link
        const shareBtn = info.querySelector('#share-btn');
        shareBtn.onclick = () => {
            const url = `${window.location.origin}/#/video?id=${video.id}`;
            navigator.clipboard.writeText(url).then(() => {
                Toast.show('Link copied to clipboard!');
            }).catch(() => {
                Toast.show('Failed to copy link', 'error');
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
        container.appendChild(wrapper);
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

        // ── Merge and shuffle ──
        const mixItems = [
            ...videos.map(v => ({ type: 'video', data: v })),
            ...images.map(img => ({ type: 'image', data: img }))
        ];

        // Fisher-Yates shuffle
        for (let i = mixItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mixItems[i], mixItems[j]] = [mixItems[j], mixItems[i]];
        }

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
            if ((!w || !h) && meta.video) {
                w = parseInt(meta.video.width) || w;
                h = parseInt(meta.video.height) || h;
            }
            return h > w && w > 0;
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Video play/pause
                const player = entry.target._player;
                if (player) {
                    if (entry.isIntersecting) player.activate();
                    else player.deactivate();
                }
                // Update counter
                if (entry.isIntersecting) {
                    const idx = entry.target.dataset.mixIdx;
                    if (idx) {
                        countBadge.textContent = `${parseInt(idx) + 1} / ${mixItems.length}`;
                    }
                }
            });
        }, { root: null, threshold: 0.6 });

        mixItems.forEach((item, i) => {
            if (item.type === 'video') {
                const video = item.data;
                const card = document.createElement('div');
                card.dataset.mixIdx = i;
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
                    const isLiked = Likes.toggleLike(video);
                    e.currentTarget.textContent = isLiked ? '❤️' : '🤍';
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
                feed.appendChild(card);
                observer.observe(card);

            } else {
                // Image card
                const image = item.data;
                const card = document.createElement('div');
                card.className = 'video-card-feed gallery-card';
                card.dataset.mixIdx = i;

                const imgContainer = document.createElement('div');
                imgContainer.className = 'gallery-img-container';

                const img = document.createElement('img');
                img.src = Gallery.getImageURL(image);
                img.alt = image.filename || 'Image';
                img.draggable = false;

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

                const info = document.createElement('div');
                info.className = 'feed-info-overlay';
                info.innerHTML = `<h3>🖼️ ${image.filename || 'Image'}</h3>`;
                card.appendChild(info);

                feed.appendChild(card);
                observer.observe(card);
            }
        });

        container.appendChild(feed);
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
        countBadge.textContent = `${images.length} images`;
        container.appendChild(countBadge);

        // ── Scroll container (TikTok-style) ──
        const feed = document.createElement('div');
        feed.className = 'video-feed';

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

            return card;
        };

        images.forEach((image, i) => {
            feed.appendChild(createImageCard(image, i));
        });

        // ── Infinite Loop ──
        const CLONE_COUNT = Math.min(3, images.length);
        for (let i = 0; i < CLONE_COUNT; i++) {
            const clone = createImageCard(images[i], `clone-end-${i}`);
            clone.classList.add('gallery-clone');
            feed.appendChild(clone);
        }
        for (let i = CLONE_COUNT - 1; i >= 0; i--) {
            const srcIdx = images.length - 1 - i;
            if (srcIdx >= 0) {
                const clone = createImageCard(images[srcIdx], `clone-start-${i}`);
                clone.classList.add('gallery-clone');
                feed.insertBefore(clone, feed.firstChild);
            }
        }

        container.appendChild(feed);

        requestAnimationFrame(() => {
            const firstReal = feed.children[CLONE_COUNT];
            if (firstReal) {
                feed.scrollTop = firstReal.offsetTop;
            }
        });

        // Infinite scroll wrapping
        let scrolling = false;
        feed.addEventListener('scrollend', () => {
            if (scrolling) return;
            scrolling = true;

            const cardHeight = feed.children[0]?.offsetHeight || window.innerHeight;
            const scrollTop = feed.scrollTop;
            const totalReal = images.length;
            const firstRealTop = feed.children[CLONE_COUNT]?.offsetTop || 0;
            const lastRealBottom = feed.children[CLONE_COUNT + totalReal - 1];

            if (lastRealBottom && scrollTop >= lastRealBottom.offsetTop + cardHeight * 0.5) {
                feed.style.scrollBehavior = 'auto';
                feed.scrollTop = firstRealTop;
                feed.style.scrollBehavior = '';
            }
            else if (scrollTop < firstRealTop - cardHeight * 0.5) {
                feed.style.scrollBehavior = 'auto';
                feed.scrollTop = lastRealBottom ? lastRealBottom.offsetTop : firstRealTop;
                feed.style.scrollBehavior = '';
            }

            scrolling = false;
        });

        let scrollTimer;
        feed.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                feed.dispatchEvent(new Event('scrollend'));
            }, 150);
        });

        // Update counter
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const idx = entry.target.dataset.idx;
                    if (idx && !String(idx).startsWith('clone')) {
                        countBadge.textContent = `${parseInt(idx) + 1} / ${images.length}`;
                    }
                }
            });
        }, { root: feed, threshold: 0.6 });

        Array.from(feed.children).forEach(card => observer.observe(card));
        // ── Hypnotic Popup System (Mini-Games) ──
        const hypnoBtn = document.createElement('button');
        hypnoBtn.className = 'hypno-toggle-btn';
        hypnoBtn.innerHTML = '🌀';
        hypnoBtn.title = 'Hypnotic Mode';
        let hypnoActive = false;
        let hypnoTimers = [];
        let currentPopup = null;

        const stopHypno = () => {
            hypnoActive = false;
            hypnoBtn.classList.remove('active');
            hypnoTimers.forEach(id => clearTimeout(id));
            hypnoTimers = [];
            container.querySelectorAll('.hypno-popup').forEach(el => el.remove());
            currentPopup = null;
        };

        const dismissPopup = (popup) => {
            popup.classList.add('hypno-solved');
            setTimeout(() => {
                popup.remove();
                currentPopup = null;
                // Spawn next after a calm delay
                if (hypnoActive) {
                    const nextId = setTimeout(spawnPopup, 3000 + Math.random() * 3000);
                    hypnoTimers.push(nextId);
                }
            }, 800);
        };

        // ── MINI-GAMES ──

        // 1. TAP CHALLENGE — tap N times to dismiss
        const gameTap = (popup, img) => {
            const needed = 5 + Math.floor(Math.random() * 11); // 5–15 taps
            let taps = 0;
            const counter = document.createElement('div');
            counter.className = 'hypno-counter';
            counter.textContent = `👆 ${needed}`;
            popup.appendChild(counter);

            popup.style.cursor = 'pointer';
            popup.onclick = (e) => {
                e.stopPropagation();
                taps++;
                const remaining = needed - taps;
                counter.textContent = remaining > 0 ? `👆 ${remaining}` : '✅';
                // Shake effect
                popup.style.animation = 'none';
                popup.offsetHeight; // force reflow
                popup.style.animation = 'hypnoShake 0.2s ease';
                if (remaining <= 0) {
                    dismissPopup(popup);
                }
            };
        };

        // 2. HOLD & REVEAL — hold for 2s on blurred image
        const gameHold = (popup, img) => {
            img.style.filter = 'blur(15px) brightness(0.5)';
            const label = document.createElement('div');
            label.className = 'hypno-counter';
            label.textContent = '✋ Hold';
            popup.appendChild(label);

            let holdTimer = null;
            let progress = 0;
            let holdInterval = null;

            popup.style.cursor = 'grab';
            popup.onmousedown = popup.ontouchstart = (e) => {
                e.preventDefault();
                popup.style.cursor = 'grabbing';
                holdInterval = setInterval(() => {
                    progress += 5;
                    img.style.filter = `blur(${Math.max(0, 15 - progress * 0.75)}px) brightness(${0.5 + progress * 0.025})`;
                    label.textContent = `${Math.min(100, progress)}%`;
                    if (progress >= 100) {
                        clearInterval(holdInterval);
                        dismissPopup(popup);
                    }
                }, 100);
            };
            popup.onmouseup = popup.ontouchend = popup.onmouseleave = () => {
                clearInterval(holdInterval);
                if (progress < 100) {
                    // Reset
                    progress = 0;
                    img.style.filter = 'blur(15px) brightness(0.5)';
                    label.textContent = '✋ Hold';
                    popup.style.cursor = 'grab';
                }
            };
        };

        // 3. CATCH ME — image dodges mouse, catch it 3 times
        const gameCatch = (popup, img) => {
            let catches = 0;
            const needed = 3;
            const label = document.createElement('div');
            label.className = 'hypno-counter';
            label.textContent = `🎯 ${needed}`;
            popup.appendChild(label);

            popup.style.cursor = 'crosshair';
            let dodging = true;

            popup.onmouseover = () => {
                if (!dodging) return;
                // Move to random position
                const maxX = window.innerWidth - popup.offsetWidth - 20;
                const maxY = window.innerHeight - popup.offsetHeight - 20;
                popup.style.left = (20 + Math.random() * maxX) + 'px';
                popup.style.top = (20 + Math.random() * maxY) + 'px';
                popup.style.transition = 'left 0.3s ease, top 0.3s ease';
            };

            popup.onclick = (e) => {
                e.stopPropagation();
                catches++;
                const remaining = needed - catches;
                label.textContent = remaining > 0 ? `🎯 ${remaining}` : '✅';
                if (remaining <= 0) {
                    dodging = false;
                    dismissPopup(popup);
                } else {
                    // Brief freeze to let user see the catch
                    dodging = false;
                    popup.style.animation = 'hypnoShake 0.3s ease';
                    setTimeout(() => { dodging = true; }, 500);
                }
            };
        };

        // 4. DOUBLE TAP — double-click to dismiss
        const gameDoubleTap = (popup, img) => {
            const label = document.createElement('div');
            label.className = 'hypno-counter';
            label.textContent = '👆👆 x2';
            popup.appendChild(label);

            popup.style.cursor = 'pointer';
            popup.ondblclick = (e) => {
                e.stopPropagation();
                label.textContent = '✅';
                dismissPopup(popup);
            };
            // Single click does a spin
            popup.onclick = (e) => {
                e.stopPropagation();
                popup.style.animation = 'none';
                popup.offsetHeight;
                popup.style.animation = 'hypnoSpin 0.5s ease';
            };
        };

        // 5. SWIPE AWAY — drag far enough to dismiss
        const gameSwipe = (popup, img) => {
            const label = document.createElement('div');
            label.className = 'hypno-counter';
            label.textContent = '👉 Swipe';
            popup.appendChild(label);

            popup.style.cursor = 'grab';
            let startX = 0, startY = 0;
            let origLeft = 0, origTop = 0;
            let dragging = false;

            const down = (e) => {
                e.preventDefault();
                dragging = true;
                const touch = e.touches ? e.touches[0] : e;
                startX = touch.clientX;
                startY = touch.clientY;
                origLeft = popup.offsetLeft;
                origTop = popup.offsetTop;
                popup.style.cursor = 'grabbing';
                popup.style.transition = 'none';
            };
            const move = (e) => {
                if (!dragging) return;
                const touch = e.touches ? e.touches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                popup.style.left = (origLeft + dx) + 'px';
                popup.style.top = (origTop + dy) + 'px';
                const dist = Math.sqrt(dx * dx + dy * dy);
                popup.style.opacity = Math.max(0.3, 1 - dist / 300);
                label.textContent = dist > 120 ? '🚀 Release!' : '👉 Swipe';
            };
            const up = (e) => {
                if (!dragging) return;
                dragging = false;
                popup.style.cursor = 'grab';
                const touch = e.changedTouches ? e.changedTouches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 120) {
                    dismissPopup(popup);
                } else {
                    popup.style.transition = 'left 0.3s ease, top 0.3s ease, opacity 0.3s ease';
                    popup.style.left = origLeft + 'px';
                    popup.style.top = origTop + 'px';
                    popup.style.opacity = '1';
                    label.textContent = '👉 Swipe';
                }
            };

            popup.onmousedown = down;
            popup.ontouchstart = down;
            document.addEventListener('mousemove', move);
            document.addEventListener('touchmove', move);
            document.addEventListener('mouseup', up);
            document.addEventListener('touchend', up);
        };

        const miniGames = [gameTap, gameHold, gameCatch, gameDoubleTap, gameSwipe];

        const spawnPopup = () => {
            if (!hypnoActive || currentPopup) return;
            const allImages = Gallery.getAll();
            if (allImages.length === 0) return;

            const randImg = allImages[Math.floor(Math.random() * allImages.length)];
            const popup = document.createElement('div');
            popup.className = 'hypno-popup';
            currentPopup = popup;

            const img = document.createElement('img');
            img.src = Gallery.getImageURL(randImg, 400);
            img.alt = '';
            img.draggable = false;
            popup.appendChild(img);

            // Smaller sizes: 100–200px
            const size = 100 + Math.random() * 100;
            const x = 40 + Math.random() * (window.innerWidth - size - 80);
            const y = 60 + Math.random() * (window.innerHeight - size - 120);

            popup.style.cssText = `
                left: ${x}px;
                top: ${y}px;
                width: ${size}px;
                height: ${size}px;
                animation: hypnoAppearSoft 0.6s ease-out forwards;
            `;

            container.appendChild(popup);

            // Pick a random mini-game
            const game = miniGames[Math.floor(Math.random() * miniGames.length)];
            game(popup, img);
        };

        hypnoBtn.onclick = () => {
            if (hypnoActive) {
                stopHypno();
                Toast.show('Hypnotic mode off');
            } else {
                hypnoActive = true;
                hypnoBtn.classList.add('active');
                Toast.show('🌀 Hypnotic mode ON — complete mini-games to dismiss!', 'info');
                // Spawn first popup after a short delay
                const id = setTimeout(spawnPopup, 1000);
                hypnoTimers.push(id);
            }
        };
        container.appendChild(hypnoBtn);
    },

    renderProfile: async (container) => {
        container.appendChild(Loader());

        try {
            const user = await API.getUserInfo();
            Store.set('user', user);

            container.innerHTML = '';
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
                    <button id="profile-logout" class="btn-primary">Sign Out</button>
                </div>
            `;

            profile.querySelector('#profile-logout').onclick = () => Auth.logout();

            container.appendChild(profile);

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
    }
};

export default UI;
