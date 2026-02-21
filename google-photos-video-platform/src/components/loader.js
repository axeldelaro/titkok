// Skeleton Loader (#31) — shimmer card placeholders
export default function Loader(type = 'grid', count = 6) {
    const container = document.createElement('div');

    if (type === 'spinner') {
        // Fallback spinner
        container.style.cssText = 'display:flex;justify-content:center;align-items:center;padding:3rem;';
        container.innerHTML = '<div class="player-spinner" style="width:50px;height:50px;"></div>';
        return container;
    }

    // Skeleton cards
    container.className = type === 'gallery' ? 'gallery-grid skeleton-grid' : 'video-grid skeleton-grid';

    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.className = 'skeleton-card';
        card.innerHTML = `
            <div class="skeleton-thumb skeleton-shimmer"></div>
            <div class="skeleton-body">
                <div class="skeleton-line skeleton-shimmer" style="width:85%"></div>
                <div class="skeleton-line skeleton-shimmer short" style="width:55%"></div>
            </div>
        `;
        container.appendChild(card);
    }

    return container;
}
