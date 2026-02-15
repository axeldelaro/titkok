// Simple State Management utilizing EventTarget

class Store extends EventTarget {
    constructor() {
        super();
        this.state = {
            videos: [],
            nextPageToken: null,
            currentVideoIndex: -1,
            user: null,
            playlists: [], // Loaded from local storage
            likes: [], // Loaded from local storage
            loading: false,
            darkMode: true
        };
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state[key] = value;
        this.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
    }

    // Actions
    setVideos(videos, nextPageToken) {
        this.state.videos = [...this.state.videos, ...videos];
        this.state.nextPageToken = nextPageToken;
        this.dispatchEvent(new CustomEvent('videosUpdated', { detail: { videos: this.state.videos } }));
    }

    setCurrentVideo(index) {
        if (index >= 0 && index < this.state.videos.length) {
            this.state.currentVideoIndex = index;
            this.dispatchEvent(new CustomEvent('videoChanged', { detail: { video: this.state.videos[index] } }));
        }
    }

    setLoading(loading) {
        this.state.loading = loading;
        this.dispatchEvent(new CustomEvent('loading', { detail: { loading } }));
    }

    removeVideo(videoId) {
        this.state.videos = this.state.videos.filter(v => v.id !== videoId);
        // Persist the deletion in localStorage
        this.hideVideo(videoId);
        this.dispatchEvent(new CustomEvent('videosUpdated', { detail: { videos: this.state.videos } }));
    }

    // Persist hidden video IDs across refreshes
    hideVideo(videoId) {
        const hidden = this.getHiddenIds();
        if (!hidden.includes(videoId)) {
            hidden.push(videoId);
            localStorage.setItem('hiddenVideoIds', JSON.stringify(hidden));
        }
    }

    getHiddenIds() {
        try {
            return JSON.parse(localStorage.getItem('hiddenVideoIds') || '[]');
        } catch {
            return [];
        }
    }
}

const store = new Store();
export default store;
