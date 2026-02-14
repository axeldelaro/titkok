import Storage from './storage.js';
import Store from './store.js';

const STORAGE_KEY = 'playlists';

const Playlist = {
    init: () => {
        const playlists = Storage.get(STORAGE_KEY) || [];
        Store.set('playlists', playlists);
    },

    create: (name) => {
        const playlists = Storage.get(STORAGE_KEY) || [];
        const newPlaylist = {
            id: Date.now().toString(),
            name,
            videos: [],
            createdAt: new Date().toISOString()
        };
        playlists.push(newPlaylist);
        Storage.set(STORAGE_KEY, playlists);
        Store.set('playlists', playlists);
        return newPlaylist;
    },

    delete: (id) => {
        let playlists = Storage.get(STORAGE_KEY) || [];
        playlists = playlists.filter(p => p.id !== id);
        Storage.set(STORAGE_KEY, playlists);
        Store.set('playlists', playlists);
    },

    addVideo: (playlistId, video) => {
        const playlists = Storage.get(STORAGE_KEY) || [];
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            // Avoid duplicates
            if (!playlist.videos.some(v => v.id === video.id)) {
                playlist.videos.push(video);
                Storage.set(STORAGE_KEY, playlists);
                Store.set('playlists', playlists);
                return true;
            }
        }
        return false;
    },

    removeVideo: (playlistId, videoId) => {
        const playlists = Storage.get(STORAGE_KEY) || [];
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            playlist.videos = playlist.videos.filter(v => v.id !== videoId);
            Storage.set(STORAGE_KEY, playlists);
            Store.set('playlists', playlists);
        }
    },

    get: (id) => {
        const playlists = Storage.get(STORAGE_KEY) || [];
        return playlists.find(p => p.id === id);
    }
};

export default Playlist;
