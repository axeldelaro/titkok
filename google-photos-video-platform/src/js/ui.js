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
import { Toast } from '../components/toast.js';

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

        // Listen for Route Changes
        window.addEventListener('routeChange', (e) => UI.handleRoute(e.detail));

        // Sidebar Toggle
        document.addEventListener('toggleSidebar', () => {
            sidebar.classList.toggle('hidden'); // Mobile toggle logic needed in CSS or here
            // Simple toggle for now
            if (sidebar.style.display === 'none') {
                sidebar.style.display = 'block';
                sidebar.style.position = 'absolute';
                sidebar.style.zIndex = '1000';
                sidebar.style.height = '100%';
            } else {
                sidebar.style.display = ''; // Reset to CSS default
            }
        });

        // Initialize features
        Likes.init();
        Playlist.init();
    },

    handleRoute: async (route) => {
        const content = document.getElementById('content');
        content.innerHTML = '';

        if (!Auth.isAuthenticated() && route.path !== '/login') {
            // Show login prompt or redirect
            content.innerHTML = `
                <div style="text-align: center; margin-top: 5rem;">
                    <h2>Welcome to CloudStream</h2>
                    <p>Please sign in with Google Photos to continue.</p>
                    <button id="login-hero" class="btn-primary" style="margin-top: 1rem; font-size: 1.2rem;">Sign In</button>
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
            case 'playlist': // Maps to /playlist but maybe list of playlists? or single playlist?
                // If ID present, render specific playlist, else list all
                const pid = route.params.get('id');
                if (pid) UI.renderPlaylistDetail(content, pid);
                else UI.renderPlaylists(content);
                break;
            case 'history':
                content.innerHTML = '<h2>History (Coming Soon)</h2>';
                break;
            default:
                content.innerHTML = '<h2>404 - Not Found</h2>';
        }
    },

    renderHome: async (container) => {
        container.appendChild(Loader());

        try {
            // Check store first
            let videos = Store.get('videos');
            if (videos.length === 0) {
                const data = await API.searchVideos();
                if (data && data.mediaItems) {
                    // Filter to ensure video (double check)
                    videos = data.mediaItems.filter(item => item.mediaMetadata.video);
                    Store.setVideos(videos, data.nextPageToken);
                }
            }

            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h2>Recommended</h2>
                    <button id="shuffle-play-btn" class="btn-primary" style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>🔀</span> Shuffle Play
                    </button>
                </div>
            `;

            const shuffleBtn = container.querySelector('#shuffle-play-btn');
            shuffleBtn.onclick = () => {
                if (videos.length > 0) {
                    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
                    Router.navigate(`/video?id=${randomVideo.id}`);
                } else {
                    Toast.show('No videos to shuffle', 'error');
                }
            };

            const grid = document.createElement('div');
            grid.className = 'video-grid';

            videos.forEach(video => {
                grid.appendChild(VideoCard(video));
            });

            container.appendChild(grid);

            if (videos.length === 0) {
                container.innerHTML = '<p>No videos found in your Google Photos library.</p>';
            }

        } catch (error) {
            console.error(error);
            container.innerHTML = `<p>Error loading videos: ${error.message}</p>`;
            Toast.show('Failed to load videos', 'error');
        }
    },

    renderVideo: async (container, id) => {
        // Find video in store or fetch
        let video = Store.get('videos').find(v => v.id === id);
        if (!video) {
            try {
                video = await API.getVideo(id);
            } catch (e) {
                container.innerHTML = '<p>Video not found</p>';
                return;
            }
        }

        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.maxWidth = '1000px';
        wrapper.style.margin = '0 auto';

        const playerContainer = document.createElement('div');
        new Player(playerContainer, video.baseUrl, video.baseUrl);
        wrapper.appendChild(playerContainer);

        const info = document.createElement('div');
        info.style.marginTop = '1rem';
        info.innerHTML = `
            <h1>${video.filename}</h1>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                <span class="text-secondary">${new Date(video.mediaMetadata.creationTime).toDateString()}</span>
                <div style="display: flex; gap: 1rem;">
                    <button id="like-btn" class="btn-icon">
                        ${Likes.isLiked(video.id) ? '❤️' : '🤍'}
                    </button>
                    <button id="add-playlist-btn" class="btn-icon">📂</button>
                    <button class="btn-icon">🔗</button>
                </div>
            </div>
            <style>
                .btn-icon { font-size: 1.5rem; padding: 0.5rem; border-radius: 50%; background: var(--surface-color); }
                .btn-icon:hover { background: #333; }
            </style>
        `;

        // Like Logic
        const likeBtn = info.querySelector('#like-btn');
        likeBtn.onclick = () => {
            const isLiked = Likes.toggleLike(video);
            likeBtn.innerHTML = isLiked ? '❤️' : '🤍';
            Toast.show(isLiked ? 'Added to Liked Videos' : 'Removed from Liked Videos');
        };

        wrapper.appendChild(info);
        container.appendChild(wrapper);
    },

    renderLikes: (container) => {
        const likes = Likes.getLikes();
        container.innerHTML = '<h2>Liked Videos</h2>';

        if (likes.length === 0) {
            container.innerHTML += '<p>No liked videos yet.</p>';
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
        // Implementation for playlists view
        container.innerHTML = '<h2>Playlists (Mock)</h2><p>Feature coming in next update.</p>';
    },

    renderPlaylistDetail: (container, id) => {
        // Implementation for single playlist
        container.innerHTML = `<h2>Playlist ${id}</h2>`;
    }
};

export default UI;
