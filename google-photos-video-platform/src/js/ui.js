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
import Playlist from './playlist.js';
import History from './history.js';
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
        uploadInput.multiple = true; // Allow multiple files
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
                        Please select a video file from your <strong>device</strong> to upload to your Google Photos library.
                        Once uploaded, it will appear in your feed here.
                    </p>
                    <button id="confirm-upload-btn" class="btn-primary" style="width:100%">
                        Select Video File
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

            // Reset input
            uploadInput.value = '';

            // Create Progress Modal
            const progressContent = `
                <div class="upload-progress-container">
                    <h3 style="margin-bottom:1rem;">Uploading ${files.length} video(s)...</h3>
                    <div id="upload-track-list"></div>
                    <div class="upload-progress-track">
                        <div id="total-progress-fill" class="upload-progress-fill"></div>
                    </div>
                    <p id="upload-status-text" class="upload-status-text">Starting...</p>
                </div>
            `;
            const progressModal = Modal('Uploading', progressContent);
            document.body.appendChild(progressModal);

            // Prevent close
            const closeBtn = progressModal.querySelector('.close-btn');
            if (closeBtn) closeBtn.style.display = 'none';

            const trackList = progressModal.querySelector('#upload-track-list');
            const totalFill = progressModal.querySelector('#total-progress-fill');
            const statusText = progressModal.querySelector('#upload-status-text');

            let completed = 0;
            let total = files.length;
            let successCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const itemDiv = document.createElement('div');
                itemDiv.className = 'upload-file-item';
                itemDiv.innerHTML = `<span>${file.name}</span> <span class="status">⏳</span>`;
                trackList.appendChild(itemDiv);

                statusText.textContent = `Uploading ${i + 1} of ${total}: ${file.name}`;

                try {
                    const mediaItem = await API.uploadVideo(file);
                    itemDiv.querySelector('.status').textContent = '✅';
                    successCount++;

                    const currentVideos = Store.get('videos') || [];
                    if (mediaItem) {
                        if (!mediaItem.mediaMetadata) mediaItem.mediaMetadata = { video: {}, creationTime: new Date().toISOString() };
                        Store.set('videos', [mediaItem, ...currentVideos]);
                    }
                } catch (err) {
                    console.error('Upload failed:', err);
                    itemDiv.querySelector('.status').textContent = '❌';
                }

                completed++;
                totalFill.style.width = `${(completed / total) * 100}%`;
            }

            statusText.textContent = `Done! ${successCount} successful.`;
            setTimeout(() => {
                progressModal.remove();
                UI.handleRoute({ route: 'home' });
                Toast.show(`Uploaded ${successCount} videos`);
            }, 1500);
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
        Playlist.init();
        History.init();
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
            case 'playlist':
                const pid = route.params.get('id');
                if (pid) UI.renderPlaylistDetail(content, pid);
                else UI.renderPlaylists(content);
                break;
            case 'history':
                UI.renderHistory(content);
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
        // Use full height for feed
        container.style.padding = '0';
        container.style.height = '100%';
        container.innerHTML = '';
        container.appendChild(Loader());

        try {
            let videos = Store.get('videos');
            if (videos.length === 0) {
                const data = await API.searchVideos();
                if (data && data.mediaItems) {
                    videos = data.mediaItems.filter(item => item.mediaMetadata.video);
                    Store.setVideos(videos, data.nextPageToken);
                }
            }

            // If still empty after fetch
            if (videos.length === 0) {
                container.style.padding = '2rem'; // Restore padding for empty state
                container.innerHTML = `
                    <div class="empty-state" style="margin-top: 20vh;">
                        <span class="empty-state-icon">📹</span>
                        <h2>No Videos Found</h2>
                        <p class="text-secondary">Upload a video to get started!</p>
                        <button id="feed-upload-btn" class="btn-primary" style="margin-top:1rem;">Upload First Video</button>
                    </div>`;
                container.querySelector('#feed-upload-btn').onclick = () => document.dispatchEvent(new CustomEvent('triggerUpload'));
                return;
            }

            container.innerHTML = ''; // Clear loader
            const feed = document.createElement('div');
            feed.className = 'video-feed';

            // Create Observer for Autoplay
            const observerOptions = {
                root: feed,
                threshold: 0.6 // Play when 60% visible
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const video = entry.target.querySelector('video');
                    if (!video) return;

                    if (entry.isIntersecting) {
                        // Play
                        video.play().catch(e => console.log('Autoplay prevented:', e));
                    } else {
                        // Pause
                        video.pause();
                        video.currentTime = 0; // Reset ? or just pause? TikTok resets usually.
                    }
                });
            }, observerOptions);

            videos.forEach(video => {
                const item = document.createElement('div');
                item.className = 'feed-video-container';

                // Construct Video Element directly
                // Using baseUrl + 'dv' for download/video stream
                const videoUrl = `${video.baseUrl}=dv`;

                item.innerHTML = `
                    <video class="feed-video-player" loop playsinline src="${videoUrl}"></video>
                    
                    <div class="feed-info-overlay">
                        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; text-shadow: 0 1px 2px black;">${video.filename}</h3>
                        <p style="font-size: 0.9rem; opacity: 0.9; text-shadow: 0 1px 2px black;">${new Date(video.mediaMetadata.creationTime).toLocaleDateString()}</p>
                    </div>

                    <div class="feed-actions">
                        <button class="action-btn like-btn" data-id="${video.id}">
                            <div class="action-icon">${Likes.isLiked(video.id) ? '❤️' : '🤍'}</div>
                            <span>Like</span>
                        </button>
                        <button class="action-btn playlist-btn">
                            <div class="action-icon">📂</div>
                            <span>Save</span>
                        </button>
                        <button class="action-btn share-btn">
                            <div class="action-icon">🔗</div>
                            <span>Share</span>
                        </button>
                    </div>
                `;

                // Handle Likes
                const likeBtn = item.querySelector('.like-btn');
                likeBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent toggling play
                    const isLiked = Likes.toggleLike(video);
                    likeBtn.querySelector('.action-icon').innerHTML = isLiked ? '❤️' : '🤍';
                    // Optional: Heart animation
                };

                // Handle Playlist
                item.querySelector('.playlist-btn').onclick = (e) => {
                    e.stopPropagation();
                    UI.showAddToPlaylistModal(video);
                };

                // Handle Share
                item.querySelector('.share-btn').onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${window.location.origin}/#/video?id=${video.id}`);
                    Toast.show('Link copied!');
                };

                // Tap to play/pause
                item.onclick = (e) => {
                    const v = item.querySelector('video');
                    if (v.paused) v.play();
                    else v.pause();
                };

                feed.appendChild(item);
                observer.observe(item);
            });

            container.appendChild(feed);

        } catch (error) {
            console.error(error);
            container.style.padding = '2rem';
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

        // Add to watch history
        History.addToHistory(video);

        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'video-page-wrapper';

        const playerContainer = document.createElement('div');
        new Player(playerContainer, video.baseUrl, video.baseUrl);
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

    renderPlaylists: (container) => {
        const playlists = Store.get('playlists') || [];

        container.innerHTML = `
            <div class="section-header">
                <h2>📂 Your Playlists</h2>
                <button id="create-playlist-btn" class="btn-primary btn-with-icon">
                    <span>➕</span> New Playlist
                </button>
            </div>
        `;

        // Create playlist button
        container.querySelector('#create-playlist-btn').onclick = () => {
            UI.showCreatePlaylistModal();
        };

        if (playlists.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <span class="empty-state-icon">📁</span>
                    <h2>No Playlists Yet</h2>
                    <p class="text-secondary">Create a playlist to organize your favorite videos.</p>
                </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'playlist-grid';

        playlists.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'playlist-card';

            const firstVideoThumb = playlist.videos.length > 0
                ? `${playlist.videos[0].baseUrl}=w400-h225-c`
                : '';

            card.innerHTML = `
                <div class="playlist-card-thumb" style="${firstVideoThumb ? `background-image:url(${firstVideoThumb})` : ''}">
                    <div class="playlist-card-count">
                        <span>▶</span> ${playlist.videos.length} video${playlist.videos.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="playlist-card-info">
                    <h3>${playlist.name}</h3>
                    <span class="text-secondary">${new Date(playlist.createdAt).toLocaleDateString()}</span>
                </div>
                <button class="playlist-delete-btn btn-icon" title="Delete playlist">🗑️</button>
            `;

            // Navigate to playlist detail
            card.querySelector('.playlist-card-thumb').onclick = () => {
                Router.navigate(`/playlist?id=${playlist.id}`);
            };
            card.querySelector('.playlist-card-info').onclick = () => {
                Router.navigate(`/playlist?id=${playlist.id}`);
            };

            // Delete playlist
            card.querySelector('.playlist-delete-btn').onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete playlist "${playlist.name}"?`)) {
                    Playlist.delete(playlist.id);
                    UI.renderPlaylists(container);
                    Toast.show('Playlist deleted');
                    // Update sidebar
                    UI.updateSidebarPlaylists();
                }
            };

            grid.appendChild(card);
        });

        container.appendChild(grid);
    },

    renderPlaylistDetail: (container, id) => {
        const playlist = Playlist.get(id);

        if (!playlist) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">📁</span>
                    <h2>Playlist Not Found</h2>
                    <p class="text-secondary">This playlist may have been deleted.</p>
                    <a href="#/playlist" class="btn-primary" style="display:inline-block;margin-top:1rem;">View All Playlists</a>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="section-header">
                <div>
                    <a href="#/playlist" class="text-secondary" style="font-size: 0.9rem;">← Back to Playlists</a>
                    <h2 style="margin-top: 0.5rem;">${playlist.name}</h2>
                    <span class="text-secondary">${playlist.videos.length} video${playlist.videos.length !== 1 ? 's' : ''} • Created ${new Date(playlist.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        `;

        if (playlist.videos.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <span class="empty-state-icon">📹</span>
                    <h2>Empty Playlist</h2>
                    <p class="text-secondary">Add videos to this playlist from any video page.</p>
                </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'video-grid';

        playlist.videos.forEach(video => {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'playlist-video-wrapper';

            const card = VideoCard(video);
            cardWrapper.appendChild(card);

            // Remove from playlist button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-from-playlist';
            removeBtn.textContent = '✕ Remove';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                Playlist.removeVideo(id, video.id);
                Toast.show('Removed from playlist');
                UI.renderPlaylistDetail(container, id);
            };
            cardWrapper.appendChild(removeBtn);

            grid.appendChild(cardWrapper);
        });

        container.appendChild(grid);
    },

    renderHistory: (container) => {
        const history = History.getHistory();

        container.innerHTML = `
            <div class="section-header">
                <h2>🕒 Watch History</h2>
                ${history.length > 0 ? `<button id="clear-history-btn" class="btn-secondary">Clear History</button>` : ''}
            </div>
        `;

        if (history.length > 0) {
            container.querySelector('#clear-history-btn').onclick = () => {
                if (confirm('Clear all watch history?')) {
                    History.clearHistory();
                    UI.renderHistory(container);
                    Toast.show('History cleared');
                }
            };
        }

        if (history.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <span class="empty-state-icon">🕒</span>
                    <h2>No Watch History</h2>
                    <p class="text-secondary">Videos you watch will appear here.</p>
                </div>`;
            return;
        }

        const list = document.createElement('div');
        list.className = 'history-list';

        history.forEach(video => {
            const item = document.createElement('div');
            item.className = 'history-item';

            const thumbnailUrl = `${video.baseUrl}=w240-h135-c`;

            item.innerHTML = `
                <div class="history-item-thumb">
                    <img src="${thumbnailUrl}" alt="${video.filename}" loading="lazy">
                </div>
                <div class="history-item-info">
                    <h3>${video.filename}</h3>
                    <span class="text-secondary">Watched ${UI.timeAgo(video.watchedAt)}</span>
                </div>
                <button class="btn-icon history-remove-btn" title="Remove from history">✕</button>
            `;

            item.querySelector('.history-item-thumb').onclick = () => {
                Router.navigate(`/video?id=${video.id}`);
            };
            item.querySelector('.history-item-info').onclick = () => {
                Router.navigate(`/video?id=${video.id}`);
            };

            item.querySelector('.history-remove-btn').onclick = (e) => {
                e.stopPropagation();
                History.removeFromHistory(video.id);
                item.remove();
                Toast.show('Removed from history');
            };

            list.appendChild(item);
        });

        container.appendChild(list);
    },

    renderProfile: async (container) => {
        container.appendChild(Loader());

        try {
            const user = await API.getUserInfo();
            Store.set('user', user);

            container.innerHTML = '';
            const profile = document.createElement('div');
            profile.className = 'profile-container';

            const stats = {
                videos: Store.get('videos').length,
                likes: (Store.get('likes') || []).length,
                playlists: (Store.get('playlists') || []).length,
                history: (Store.get('history') || []).length
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
                        <span class="stat-icon">📂</span>
                        <span class="stat-value">${stats.playlists}</span>
                        <span class="stat-label">Playlists</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon">🕒</span>
                        <span class="stat-value">${stats.history}</span>
                        <span class="stat-label">Watched</span>
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

    // ---- Modals ----

    showCreatePlaylistModal: () => {
        const modalContent = `
            <div class="modal-form">
                <label for="playlist-name-input" class="modal-label">Playlist Name</label>
                <input type="text" id="playlist-name-input" class="modal-input" placeholder="My Awesome Playlist" autofocus>
                <button id="modal-create-btn" class="btn-primary" style="width:100%;margin-top:1rem;">Create</button>
            </div>
        `;

        const modal = Modal('Create New Playlist', modalContent);
        document.body.appendChild(modal);

        const input = modal.querySelector('#playlist-name-input');
        const createBtn = modal.querySelector('#modal-create-btn');

        const doCreate = () => {
            const name = input.value.trim();
            if (!name) {
                Toast.show('Please enter a playlist name', 'error');
                return;
            }
            Playlist.create(name);
            Toast.show(`Playlist "${name}" created!`);
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);

            // Refresh playlists view if currently on it
            const content = document.getElementById('content');
            if (window.location.hash === '#/playlist' || window.location.hash === '#/playlists') {
                UI.renderPlaylists(content);
            }
            UI.updateSidebarPlaylists();
        };

        createBtn.onclick = doCreate;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') doCreate();
        };
    },

    showAddToPlaylistModal: (video) => {
        const playlists = Store.get('playlists') || [];

        let listHtml = '';
        if (playlists.length === 0) {
            listHtml = '<p class="text-secondary" style="margin-bottom:1rem;">No playlists yet. Create one first!</p>';
        } else {
            listHtml = `<div class="modal-playlist-list">
                ${playlists.map(p => `
                    <button class="modal-playlist-item" data-id="${p.id}">
                        <span>📂</span>
                        <span>${p.name}</span>
                        <span class="text-secondary" style="margin-left:auto;">${p.videos.length} videos</span>
                    </button>
                `).join('')}
            </div>`;
        }

        const modalContent = `
            ${listHtml}
            <hr style="border:none;border-top:1px solid var(--border-color);margin:1rem 0;">
            <button id="modal-new-playlist-btn" class="btn-secondary" style="width:100%;">➕ Create New Playlist</button>
        `;

        const modal = Modal('Add to Playlist', modalContent);
        document.body.appendChild(modal);

        // Click on existing playlist
        modal.querySelectorAll('.modal-playlist-item').forEach(btn => {
            btn.onclick = () => {
                const playlistId = btn.dataset.id;
                const added = Playlist.addVideo(playlistId, video);
                if (added) {
                    Toast.show('Added to playlist!');
                } else {
                    Toast.show('Video already in playlist', 'error');
                }
                modal.classList.remove('open');
                setTimeout(() => modal.remove(), 300);
            };
        });

        // Create new playlist then add
        const newBtn = modal.querySelector('#modal-new-playlist-btn');
        if (newBtn) {
            newBtn.onclick = () => {
                modal.classList.remove('open');
                setTimeout(() => {
                    modal.remove();
                    // Show create modal, then auto-add video to it
                    UI.showCreatePlaylistAndAddVideo(video);
                }, 300);
            };
        }
    },

    showCreatePlaylistAndAddVideo: (video) => {
        const modalContent = `
            <div class="modal-form">
                <label for="playlist-name-input" class="modal-label">Playlist Name</label>
                <input type="text" id="playlist-name-input" class="modal-input" placeholder="My Awesome Playlist" autofocus>
                <button id="modal-create-add-btn" class="btn-primary" style="width:100%;margin-top:1rem;">Create & Add Video</button>
            </div>
        `;

        const modal = Modal('Create New Playlist', modalContent);
        document.body.appendChild(modal);

        const input = modal.querySelector('#playlist-name-input');
        const createBtn = modal.querySelector('#modal-create-add-btn');

        const doCreate = () => {
            const name = input.value.trim();
            if (!name) {
                Toast.show('Please enter a playlist name', 'error');
                return;
            }
            const newPlaylist = Playlist.create(name);
            Playlist.addVideo(newPlaylist.id, video);
            Toast.show(`Created "${name}" and added video!`);
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
            UI.updateSidebarPlaylists();
        };

        createBtn.onclick = doCreate;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') doCreate();
        };
    },

    // ---- Helpers ----

    updateSidebarPlaylists: () => {
        const sidebarPlaylists = document.getElementById('sidebar-playlists');
        if (!sidebarPlaylists) return;

        const playlists = Store.get('playlists') || [];
        if (playlists.length === 0) {
            sidebarPlaylists.innerHTML = '<p style="font-size: 0.8rem; color: #666;">No playlists yet</p>';
            return;
        }

        sidebarPlaylists.innerHTML = playlists.map(p => `
            <a href="#/playlist?id=${p.id}" class="nav-item sidebar-playlist-link">
                <span>📂</span>
                <span>${p.name}</span>
            </a>
        `).join('');
    },

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
