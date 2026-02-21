// Player with enhanced features: loop toggle, video filters, zoom/pan, progress memory, cinema mode, download
export default class Player {
    constructor(container, videoUrl, posterUrl, options = {}) {
        this.container = container;
        this.videoUrl = videoUrl;
        this.posterUrl = posterUrl;
        this.video = null;
        this.controls = null;
        this.isPlaying = false;
        this.hideControlsTimer = null;
        this.lazy = options.lazy === true;
        this.isBlob = this.videoUrl && this.videoUrl.startsWith('blob:');
        this.mediaItemId = options.mediaItemId || null;
        this._retryCount = 0;
        this._maxRetries = 3;
        // Feature: Video Filters (#7) — GLOBAL: shared across all players
        this._filters = [
            { name: 'None', css: 'none' },
            { name: 'Grayscale', css: 'grayscale(1)' },
            { name: 'Sepia', css: 'sepia(1)' },
            { name: 'Invert (Full)', css: 'invert(1)' },
            { name: 'Invert (Light)', css: 'invert(1) hue-rotate(180deg)' },
            { name: 'Saturate', css: 'saturate(2.5)' },
            { name: 'High Contrast', css: 'contrast(1.8)' },
            { name: 'Warm', css: 'sepia(0.4) saturate(1.5) brightness(1.1)' },
            { name: 'Cool', css: 'hue-rotate(180deg) saturate(1.3)' },
            { name: 'Vintage', css: 'sepia(0.6) contrast(1.1) brightness(0.9)' },
            { name: 'Negative', css: 'invert(1) contrast(1.3)' },
            { name: 'Delay 1', css: 'none', delay: 1 },
            { name: 'Delay 2', css: 'none', delay: 2 },
            { name: 'Delay 3', css: 'none', delay: 3 },
            { name: 'Delay 4', css: 'none', delay: 4 },
            { name: 'Delay 5', css: 'none', delay: 5 }
        ];
        // Read global filter from localStorage
        this._filterIndex = parseInt(localStorage.getItem('playerFilterIndex') || '0', 10);
        if (this._filterIndex >= this._filters.length) this._filterIndex = 0;
        // Feature: Cinema Mode (#11)
        this._cinemaMode = false;
        // Feature: Zoom & Pan (#6)
        this._zoomLevel = 1;
        this._panX = 0;
        this._panY = 0;
        // Delay canvas layers
        this._delayLayers = [];

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.className = 'player-wrapper';

        // ── Video Element ───────────────────────────────────────
        this.video = document.createElement('video');
        this.video.poster = this.isBlob ? '' : `${this.posterUrl}=w1920-h1080`;
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.objectFit = 'contain';
        this.video.style.backgroundColor = '#000';
        this.video.style.touchAction = 'pan-y';
        this.video.style.transition = 'filter 0.3s, transform 0.2s';
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.controls = false;
        this.video.loop = true;
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('muted', '');

        // ── Loading Overlay ──────────────────────────────────────
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'player-loading-overlay player-overlay-hidden';
        this.loadingOverlay.innerHTML = `
            <div class="player-spinner"></div>
            <span>Loading video…</span>
        `;

        // ── Error Overlay ────────────────────────────────────────
        this.errorOverlay = document.createElement('div');
        this.errorOverlay.className = 'player-error-overlay player-overlay-hidden';
        this.errorOverlay.innerHTML = `
            <span style="font-size:2.5rem;">⚠️</span>
            <p style="margin:0.5rem 0;">Video could not be loaded</p>
            <p style="font-size:0.8rem;color:var(--text-secondary,#aaa);margin-bottom:1rem;">Tap retry to refresh the video URL.</p>
            <button class="player-retry-btn">🔄 Retry</button>
        `;
        this.errorOverlay.querySelector('.player-retry-btn').onclick = () => {
            this._retryCount = 0;
            this.hideError();
            this._retryPlayback();
        };

        // ── Custom Controls ─────────────────────────────────────
        this.controls = document.createElement('div');
        this.controls.className = 'player-controls';
        this.controls.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-buffered"></div>
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="controls-row">
                <button class="play-btn" title="Play (Space)">▶</button>
                <div class="volume-container">
                    <button class="mute-btn" title="Mute (M)">🔇</button>
                    <input type="range" min="0" max="1" step="0.05" value="0" class="volume-slider">
                </div>
                <span class="time-display">00:00 / 00:00</span>
                <div style="flex: 1;"></div>
                <button class="loop-btn ctrl-btn" title="Loop (L)">🔁</button>
                <button class="filter-btn ctrl-btn" title="Filter (V)">🎨</button>
                <button class="cinema-btn ctrl-btn" title="Cinema (C)">🎬</button>
                <button class="zoom-btn ctrl-btn" title="Zoom (Z)">🔍</button>
                <button class="download-btn ctrl-btn" title="Download (D)">⬇️</button>
                <button class="speed-btn" title="Playback speed">1x</button>
                <button class="pip-btn" title="Picture in Picture">🖼</button>
                <button class="fullscreen-btn" title="Fullscreen (F)">⛶</button>
            </div>
        `;

        // ── Build DOM ────────────────────────────────────────────
        this.container.appendChild(this.video);
        this.container.appendChild(this.loadingOverlay);
        this.container.appendChild(this.errorOverlay);
        this.container.appendChild(this.controls);
        this.container.style.touchAction = 'pan-y';

        // ── Video Events ─────────────────────────────────────────
        const onReady = () => {
            this._retryCount = 0;
            this.hideLoading();
            if (this._loadingTimeout) {
                clearTimeout(this._loadingTimeout);
                this._loadingTimeout = null;
            }
            // Feature #2: Restore progress
            this._restoreProgress();
            // Auto-unmute: try to unmute with sound once video is ready
            if (this.video.muted) {
                try {
                    this.video.muted = false;
                    this.video.volume = 0.5;
                    const muteBtn = this.controls.querySelector('.mute-btn');
                    const volumeSlider = this.controls.querySelector('.volume-slider');
                    if (muteBtn) muteBtn.textContent = '\ud83d\udd09';
                    if (volumeSlider) volumeSlider.value = 0.5;
                } catch (e) { /* browser blocked unmute */ }
            }
            // Apply global filter on load
            this._applyCurrentFilter();
        };
        this.video.addEventListener('canplay', onReady);
        this.video.addEventListener('playing', onReady);
        this.video.addEventListener('loadeddata', onReady);
        this.video.addEventListener('loadedmetadata', onReady);

        this.video.addEventListener('error', () => {
            if (this.video.src && this.video.src !== window.location.href) {
                console.warn(`[Player] Error (attempt ${this._retryCount + 1}/${this._maxRetries}):`, this.video.error, 'networkState:', this.video.networkState);
                if (this._retryCount < this._maxRetries) {
                    this._retryCount++;
                    const delay = this._retryCount * 2000;
                    console.log(`[Player] Auto-retrying in ${delay}ms...`);
                    setTimeout(() => this._retryPlayback(), delay);
                } else {
                    this.hideLoading();
                    this.showError();
                    console.error('[Player] All retries exhausted:', this.videoUrl);
                }
            }
        });

        this.attachEvents();

        if (!this.lazy) {
            this.startPlayback();
        }
    }

    // Show/hide helpers
    showLoading() { this.loadingOverlay.classList.remove('player-overlay-hidden'); }
    hideLoading() { this.loadingOverlay.classList.add('player-overlay-hidden'); }
    showError() { this.errorOverlay.classList.remove('player-overlay-hidden'); }
    hideError() { this.errorOverlay.classList.add('player-overlay-hidden'); }

    // Feature #2: Video Progress Memory
    _saveProgress() {
        if (!this.mediaItemId || !this.video.duration) return;
        const progress = JSON.parse(localStorage.getItem('videoProgress') || '{}');
        progress[this.mediaItemId] = {
            time: this.video.currentTime,
            duration: this.video.duration,
            updatedAt: Date.now()
        };
        // Keep only last 200 entries
        const keys = Object.keys(progress);
        if (keys.length > 200) {
            const sorted = keys.sort((a, b) => progress[a].updatedAt - progress[b].updatedAt);
            sorted.slice(0, keys.length - 200).forEach(k => delete progress[k]);
        }
        localStorage.setItem('videoProgress', JSON.stringify(progress));
    }

    _restoreProgress() {
        if (!this.mediaItemId) return;
        const progress = JSON.parse(localStorage.getItem('videoProgress') || '{}');
        const saved = progress[this.mediaItemId];
        if (saved && saved.time > 2 && saved.time < (saved.duration - 2)) {
            this.video.currentTime = saved.time;
        }
    }

    // Retry playback
    async _retryPlayback() {
        this.showLoading();
        this.hideError();

        if (this.isBlob) {
            this.video.src = this.videoUrl;
            this.video.load();
            this.video.play().catch(() => { });
            return;
        }

        if (this.mediaItemId) {
            try {
                const { default: API } = await import('./api.js');
                const fresh = await API.getVideo(this.mediaItemId);
                if (fresh && fresh.baseUrl) {
                    console.log('[Player] Got fresh URL from API');
                    this.videoUrl = fresh.baseUrl;
                    this.video.src = `${fresh.baseUrl}=dv`;
                    this.video.load();
                    this.video.play().catch(() => { });
                    return;
                }
            } catch (e) {
                console.warn('[Player] Could not fetch fresh URL:', e.message);
            }
        }

        this.video.src = `${this.videoUrl}=dv&_t=${Date.now()}`;
        this.video.load();
        this.video.play().catch(() => { });
    }

    startPlayback() {
        this._started = true;
        this.showLoading();
        this.video.src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;
        this.video.preload = 'auto';
        this.video.load();
        this.video.play().catch(() => { });

        if (this._loadingTimeout) clearTimeout(this._loadingTimeout);
        this._loadingTimeout = setTimeout(() => {
            this.hideLoading();
            this._loadingTimeout = null;
        }, 5000);
    }

    activate() {
        // FIX: video.src est égal à window.location.href quand il n'est pas défini (comportement navigateur).
        // On teste `_started` pour savoir si startPlayback a déjà été appelé.
        if (!this._started) {
            this.startPlayback();
        } else {
            this.video.play().catch(() => { });
        }
    }

    deactivate() {
        this._saveProgress();
        this.video.pause();
    }

    attachEvents() {
        const playBtn = this.controls.querySelector('.play-btn');
        const muteBtn = this.controls.querySelector('.mute-btn');
        const volumeSlider = this.controls.querySelector('.volume-slider');
        const fullscreenBtn = this.controls.querySelector('.fullscreen-btn');
        const pipBtn = this.controls.querySelector('.pip-btn');
        const speedBtn = this.controls.querySelector('.speed-btn');
        const loopBtn = this.controls.querySelector('.loop-btn');
        const filterBtn = this.controls.querySelector('.filter-btn');
        const cinemaBtn = this.controls.querySelector('.cinema-btn');
        const zoomBtn = this.controls.querySelector('.zoom-btn');
        const downloadBtn = this.controls.querySelector('.download-btn');
        const progressContainer = this.controls.querySelector('.progress-bar-container');
        const progressFill = this.controls.querySelector('.progress-fill');
        const progressBuffered = this.controls.querySelector('.progress-buffered');
        const timeDisplay = this.controls.querySelector('.time-display');

        // Play/Pause
        const togglePlay = () => {
            if (this.video.paused) {
                this.video.play();
                playBtn.textContent = '⏸';
                this.isPlaying = true;
            } else {
                this.video.pause();
                playBtn.textContent = '▶';
                this.isPlaying = false;
            }
        };

        playBtn.onclick = togglePlay;
        this.video.onclick = (e) => {
            // Double-click detection is handled externally for double-tap like
            togglePlay();
        };

        // Mute Toggle
        muteBtn.onclick = () => {
            this.video.muted = !this.video.muted;
            if (!this.video.muted && this.video.volume === 0) {
                this.video.volume = 1;
            }
            muteBtn.textContent = this.video.muted ? '🔇' : (this.video.volume > 0.5 ? '🔊' : '🔉');
            volumeSlider.value = this.video.muted ? 0 : this.video.volume;
        };

        // Volume Slider
        volumeSlider.oninput = (e) => {
            const vol = parseFloat(e.target.value);
            this.video.volume = vol;
            this.video.muted = vol === 0;
            muteBtn.textContent = vol === 0 ? '🔇' : (vol > 0.5 ? '🔊' : '🔉');
        };

        // Time Update — also saves progress periodically
        let progressSaveCounter = 0;
        this.video.ontimeupdate = () => {
            if (!this.video.duration) return;
            const percent = (this.video.currentTime / this.video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
            if (!this.video.paused && playBtn.textContent !== '⏸') {
                playBtn.textContent = '⏸';
                this.isPlaying = true;
            }
            // Save progress every ~5 seconds
            progressSaveCounter++;
            if (progressSaveCounter % 25 === 0) this._saveProgress();
        };

        // Buffer progress
        this.video.onprogress = () => {
            if (this.video.buffered.length > 0 && this.video.duration) {
                const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
                const percent = (bufferedEnd / this.video.duration) * 100;
                progressBuffered.style.width = `${percent}%`;
            }
        };

        // Video ended
        this.video.onended = () => {
            playBtn.textContent = '▶';
            this.isPlaying = false;
            this._saveProgress();
            // Dispatch custom event for auto-play-next (#3)
            this.container.dispatchEvent(new CustomEvent('videoEnded', { bubbles: true }));
        };

        // Seek
        progressContainer.onclick = (e) => {
            if (!this.video.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.video.currentTime = pos * this.video.duration;
        };

        // Fullscreen — fullscreen the whole page so user can still scroll
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
            } else {
                document.exitFullscreen();
            }
        };

        // PIP
        pipBtn.onclick = async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else if (document.pictureInPictureEnabled) {
                    await this.video.requestPictureInPicture();
                }
            } catch (e) { /* PIP not supported */ }
        };

        // Feature #4: Loop Toggle
        loopBtn.style.opacity = this.video.loop ? '1' : '0.5';
        loopBtn.onclick = () => {
            this.video.loop = !this.video.loop;
            loopBtn.style.opacity = this.video.loop ? '1' : '0.5';
        };

        // Feature #7: Video Filters + Delay Echo (GLOBAL)
        filterBtn.onclick = () => {
            this._filterIndex = (this._filterIndex + 1) % this._filters.length;
            localStorage.setItem('playerFilterIndex', this._filterIndex);
            this._applyCurrentFilter();
        };

        // Feature #11: Cinema Mode
        cinemaBtn.onclick = () => {
            this._cinemaMode = !this._cinemaMode;
            let overlay = document.getElementById('cinema-overlay');
            if (this._cinemaMode) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'cinema-overlay';
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999;transition:opacity 0.4s;opacity:0;pointer-events:none;';
                    document.body.appendChild(overlay);
                    requestAnimationFrame(() => overlay.style.opacity = '1');
                }
                this.container.style.position = 'relative';
                this.container.style.zIndex = '1000';
                cinemaBtn.style.opacity = '1';
                cinemaBtn.style.color = '#ffd700';
            } else {
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 400);
                }
                this.container.style.zIndex = '';
                cinemaBtn.style.opacity = '0.7';
                cinemaBtn.style.color = '';
            }
        };

        // Feature #6: Zoom
        const zoomLevels = [1, 1.5, 2, 3];
        let zoomIdx = 0;
        zoomBtn.onclick = () => {
            zoomIdx = (zoomIdx + 1) % zoomLevels.length;
            this._zoomLevel = zoomLevels[zoomIdx];
            this._panX = 0;
            this._panY = 0;
            this._applyZoom();
            zoomBtn.textContent = this._zoomLevel > 1 ? `🔍${this._zoomLevel}x` : '🔍';
        };

        // Wheel zoom on desktop
        this.container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this._zoomLevel = Math.max(1, Math.min(5, this._zoomLevel + (e.deltaY > 0 ? -0.25 : 0.25)));
                if (this._zoomLevel <= 1) { this._panX = 0; this._panY = 0; }
                this._applyZoom();
            }
        }, { passive: false });

        // Drag to pan when zoomed
        let isDragging = false, dragStartX, dragStartY, panStartX, panStartY;
        this.video.addEventListener('mousedown', (e) => {
            if (this._zoomLevel > 1) {
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                panStartX = this._panX;
                panStartY = this._panY;
                e.preventDefault();
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging && this._zoomLevel > 1) {
                this._panX = panStartX + (e.clientX - dragStartX);
                this._panY = panStartY + (e.clientY - dragStartY);
                this._applyZoom();
            }
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        // Feature #12: Download
        downloadBtn.onclick = async () => {
            try {
                const url = this.video.src;
                const a = document.createElement('a');
                a.href = url;
                a.download = `video_${Date.now()}.mp4`;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (err) {
                console.warn('[Player] Download failed:', err);
            }
        };

        // Speed control
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        let currentSpeedIndex = 2;
        speedBtn.onclick = () => {
            currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
            this.video.playbackRate = speeds[currentSpeedIndex];
            speedBtn.textContent = `${speeds[currentSpeedIndex]}x`;
        };

        // Keyboard shortcuts (enhanced #35)
        this._keyHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'f':
                    e.preventDefault();
                    fullscreenBtn.click();
                    break;
                case 'm':
                    e.preventDefault();
                    muteBtn.click();
                    break;
                case 'l':
                    e.preventDefault();
                    loopBtn.click();
                    break;
                case 'v':
                    e.preventDefault();
                    filterBtn.click();
                    break;
                case 'c':
                    e.preventDefault();
                    cinemaBtn.click();
                    break;
                case 'z':
                    e.preventDefault();
                    zoomBtn.click();
                    break;
                case 'd':
                    e.preventDefault();
                    downloadBtn.click();
                    break;
                case 'j':
                    e.preventDefault();
                    this.video.currentTime = Math.max(0, this.video.currentTime - 10);
                    break;
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case ';': // mapped to L on AZERTY
                    e.preventDefault();
                    this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 10);
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    this.video.currentTime = Math.max(0, this.video.currentTime - 5);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    this.video.volume = Math.min(1, this.video.volume + 0.1);
                    volumeSlider.value = this.video.volume;
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    this.video.volume = Math.max(0, this.video.volume - 0.1);
                    volumeSlider.value = this.video.volume;
                    break;
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        // Auto-hide controls
        this.container.onmousemove = () => {
            this.controls.style.opacity = '1';
            clearTimeout(this.hideControlsTimer);
            this.hideControlsTimer = setTimeout(() => {
                if (this.isPlaying) {
                    this.controls.style.opacity = '0';
                }
            }, 3000);
        };
    }

    _applyZoom() {
        this.video.style.transform = `scale(${this._zoomLevel}) translate(${this._panX / this._zoomLevel}px, ${this._panY / this._zoomLevel}px)`;
    }

    // ── Apply current filter (CSS + delay) ──
    _applyCurrentFilter() {
        const f = this._filters[this._filterIndex];
        this.video.style.filter = f.css;
        const filterBtn = this.controls?.querySelector('.filter-btn');
        if (filterBtn) filterBtn.title = `Filter: ${f.name}`;

        // Handle delay canvases
        this._clearDelay();
        if (f.delay) {
            this._applyDelay(f.delay);
        }
    }

    // ── Delay: single-canvas feedback loop for true video trail ──
    _applyDelay(level) {
        this._clearDelay();

        // Plus le fadeAlpha est bas, plus la trainée est longue
        const FADE_ALPHAS = [0.15, 0.08, 0.04, 0.02, 0.01];
        const fadeAlpha = FADE_ALPHAS[Math.min(level - 1, FADE_ALPHAS.length - 1)];

        // ── Créer le canvas de feedback ──────────────────────────
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position:absolute; top:0; left:0;
            width:100%; height:100%;
            pointer-events:none;
            z-index:2;
            object-fit:contain;
        `;
        this.container.insertBefore(canvas, this.controls);

        // Masquer la vidéo native — le canvas la remplace visuellement
        this.video.style.opacity = '0';

        const ctx = canvas.getContext('2d', { willReadFrequently: false });

        // Boucle RAF
        let running = true;
        const tick = () => {
            if (!running || !canvas.parentNode) return;
            requestAnimationFrame(tick);

            if (this.video.paused || this.video.readyState < 2) return;

            const w = this.video.videoWidth || canvas.width || 640;
            const h = this.video.videoHeight || canvas.height || 360;

            // Redimensionner le canvas si nécessaire (reset l'état mais c'est acceptable)
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                // Initialiser en noir pour que le fondu démarre proprement
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, w, h);
            }

            // 1. Fondu du contenu précédent → crée l'effet de trainée
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = fadeAlpha;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);

            // 2. Dessiner la frame courante par-dessus avec faible opacité
            //    → les anciennes frames restent visibles en transparence
            ctx.globalAlpha = 0.85;
            ctx.drawImage(this.video, 0, 0, w, h);
            ctx.globalAlpha = 1.0;
        };

        // Démarrer la boucle
        requestAnimationFrame(tick);

        this._delayLayers = [{ el: canvas }];
        // Stocker le flag d'arrêt pour pouvoir stopper la boucle
        this._delayStop = () => { running = false; };
    }


    _clearDelay() {
        // Stopper la boucle RAF via le flag de closure
        if (this._delayStop) {
            this._delayStop();
            this._delayStop = null;
        }
        // Ancienne méthode (compatibilité si _delayRaf existait)
        if (this._delayRaf) {
            cancelAnimationFrame(this._delayRaf);
            this._delayRaf = null;
        }
        // Supprimer les canvas de l'effet
        if (this._delayLayers) {
            this._delayLayers.forEach(({ el }) => {
                if (el.parentNode) el.remove();
            });
        }
        this._delayLayers = [];
        // Restaurer la visibilité de la vidéo native
        if (this.video) this.video.style.opacity = '1';
    }


    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    destroy() {
        this._saveProgress();
        this._clearDelay();
        // Remove cinema overlay if active
        const cin = document.getElementById('cinema-overlay');
        if (cin) cin.remove();
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        if (this.video) {
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
        }
    }
}
