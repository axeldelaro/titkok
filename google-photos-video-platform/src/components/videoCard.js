import Router from '../js/router.js';
import { formatDuration } from '../js/utils.js';

export default function VideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    // Google Photos base URL allows sizing/cropping
    // w=width, h=height, c=crop, d=download (for video we want thumbnail first)
    // For video streams, we use the base url + 'dv'
    const thumbnailUrl = `${video.baseUrl}=w400-h225-c`;

    // Metadata (mock if missing)
    const duration = video.mediaMetadata.video ? formatDuration(0) : '00:00';
    // Metadata.video doesn't always have duration, sometimes it's in a separate field or requires parsing.
    // Actually Google Photos API mediaMetadata.video usually has fps, status. Duration might be missing in search results or formatted differently.
    // We'll trust the user to have valid videos.

    card.innerHTML = `
        <div class="thumbnail-container" style="position: relative; aspect-ratio: 16/9; background: #000; overflow: hidden; border-radius: 8px;">
            <img src="${thumbnailUrl}" alt="Video Thumbnail" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
            <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); padding: 2px 6px; font-size: 0.8rem; border-radius: 4px;">
                Video
            </span>
            <div class="hover-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 3rem;">▶</span>
            </div>
        </div>
        <div style="padding: 0.8rem 0;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.3rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${video.filename}
            </h3>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                <span>${new Date(video.mediaMetadata.creationTime).toLocaleDateString()}</span>
            </div>
        </div>
        <style>
            .video-card { cursor: pointer; transition: transform 0.2s; }
            .video-card:hover { transform: scale(1.02); }
            .video-card:hover .hover-overlay { opacity: 1; }
        </style>
    `;

    card.onclick = () => {
        Router.navigate(`/video?id=${video.id}`);
    };

    return card;
}
