import Storage from './storage.js';
import Store from './store.js';

const STORAGE_KEY = 'liked_videos';

const Likes = {
    init: () => {
        const likes = Storage.get(STORAGE_KEY) || [];
        Store.set('likes', likes);
    },

    toggleLike: (video) => {
        let likes = Storage.get(STORAGE_KEY) || [];
        const index = likes.findIndex(v => v.id === video.id);

        if (index === -1) {
            likes.push(video);
        } else {
            likes.splice(index, 1);
        }

        Storage.set(STORAGE_KEY, likes);
        Store.set('likes', likes);
        return index === -1; // true if liked, false if unliked
    },

    isLiked: (videoId) => {
        const likes = Store.get('likes') || [];
        return likes.some(v => v.id === videoId);
    },

    getLikes: () => {
        return Storage.get(STORAGE_KEY) || [];
    }
};

export default Likes;
