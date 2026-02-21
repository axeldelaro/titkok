// VideoCard with Quality Badge (#15) and improved interactions
import Router from '../js/router.js';
import { formatDuration } from '../js/utils.js';

export default function VideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    const thumbnailUrl = `${video.baseUrl}=w400-h225-c`;

    // Metadata
    const title = video.filename || 'Untitled';
    const createdDate = video.mediaMetadata?.creationTime
        ? new Date(video.mediaMetadata.creationTime).toLocaleDateString()
        : '';
    const duration = video.mediaMetadata?.video?.duration;

    // Quality badge text
    const w = parseInt(video.mediaMetadata?.width || 0);
    const h = parseInt(video.mediaMetadata?.height || 0);
    let qualityLabel = '';
    if (w >= 3840 || h >= 2160) qualityLabel = '4K';
    else if (w >= 1920 || h >= 1080) qualityLabel = 'HD';
    else if (w >= 1280 || h >= 720) qualityLabel = '720p';

    card.innerHTML = `
        <div class="video-thumb" style="position:relative;">
            <img src="${thumbnailUrl}" alt="${title}" loading="lazy" onerror="this.style.display='none'">
            ${duration ? `<span class="video-duration">${formatDuration(duration)}</span>` : ''}
            ${qualityLabel ? `<span class="quality-badge">${qualityLabel}</span>` : ''}
        </div>
        <div class="video-card-info">
            <h3 class="video-card-title" title="${title}">${title}</h3>
            <span class="text-secondary" style="font-size:0.8rem;">${createdDate}</span>
        </div>
    `;

    card.onclick = () => {
        Router.navigate(`/video?id=${video.id}`);
    };

    return card;
}
