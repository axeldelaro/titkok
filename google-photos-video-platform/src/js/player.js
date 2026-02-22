// Player — 3 filtres : Lèvres / Inversion / Ghost Trail
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

        // ── 3 filtres seulement ──────────────────────────────────────
        this._filters = [
            { name: 'Normal', css: 'none' },
            { name: 'Lèvres', css: 'saturate(3) hue-rotate(-20deg) contrast(1.1)' },
            { name: 'Inversion', css: 'invert(1)' },
            { name: 'Ghost Trail', css: 'none', delay: true },
        ];

        this._filterIndex = parseInt(localStorage.getItem('playerFilterIndex') || '0', 10);
        if (this._filterIndex >= this._filters.length) this._filterIndex = 0;

        // Ghost Trail strength  0 = longue traînée / 1 = traînée courte
        this._delayStrength = Math.max(0, Math.min(1,
            parseFloat(localStorage.getItem('playerDelayStrength') ?? '0.3')
        ));

        this._cinemaMode = false;
        this._zoomLevel = 1;
        this._panX = 0;
        this._panY = 0;

        // RAF delay state
        this._rafId = null;
        this._delayCanvas = null;
        this._delayRunning = false;

        this.init();
    }

    // ─────────────────────────────────────────────────────────────────────
    init() {
        this.container.innerHTML = '';
        this.container.className = 'player-wrapper';

        // Video
        this.video = document.createElement('video');
        this.video.poster = this.isBlob ? '' : `${this.posterUrl}=w1920-h1080`;
        this.video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;touch-action:pan-y;transition:filter 0.3s,transform 0.2s;';
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.controls = false;
        this.video.loop = true;
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('muted', '');

        // Loading overlay
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'player-loading-overlay player-overlay-hidden';
        this.loadingOverlay.innerHTML = '<div class="player-spinner"></div><span>Loading…</span>';

        // Error overlay
        this.errorOverlay = document.createElement('div');
        this.errorOverlay.className = 'player-error-overlay player-overlay-hidden';
        this.errorOverlay.innerHTML = `
            <span style="font-size:2.5rem">⚠️</span>
            <p style="margin:0.5rem 0">Video could not be loaded</p>
            <button class="player-retry-btn">🔄 Retry</button>`;
        this.errorOverlay.querySelector('.player-retry-btn').onclick = () => {
            this._retryCount = 0;
            this.hideError();
            this._retryPlayback();
        };

        // Controls
        this.controls = document.createElement('div');
        this.controls.className = 'player-controls';
        this.controls.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-buffered"></div>
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="delay-strength-row" style="display:none;align-items:center;gap:0.5rem;padding:0 0.25rem 0.25rem">
                <span style="font-size:0.75rem;white-space:nowrap;opacity:0.8">👻 Trail</span>
                <input type="range" min="0" max="1" step="0.01" class="delay-strength-slider" style="flex:1;accent-color:var(--primary-color,#ff4081);">
                <span class="delay-strength-label" style="font-size:0.75rem;min-width:2.5em;text-align:right;opacity:0.8"></span>
            </div>
            <div class="controls-row">
                <button class="play-btn"          title="Play (Space)">▶</button>
                <div class="volume-container">
                    <button class="mute-btn"      title="Mute (M)">🔇</button>
                    <input type="range" min="0" max="1" step="0.05" value="0" class="volume-slider">
                </div>
                <span class="time-display">00:00 / 00:00</span>
                <div style="flex:1"></div>
                <button class="loop-btn   ctrl-btn" title="Loop (L)">🔁</button>
                <button class="filter-btn ctrl-btn" title="Filtre (V)">🎨</button>
                <button class="cinema-btn ctrl-btn" title="Cinema (C)">🎬</button>
                <button class="zoom-btn   ctrl-btn" title="Zoom (Z)">🔍</button>
                <button class="download-btn ctrl-btn" title="Download (D)">⬇️</button>
                <button class="speed-btn"             title="Vitesse">1x</button>
                <button class="pip-btn"               title="PiP">🖼</button>
                <button class="fullscreen-btn"        title="Fullscreen (F)">⛶</button>
            </div>`;

        this.container.appendChild(this.video);
        this.container.appendChild(this.loadingOverlay);
        this.container.appendChild(this.errorOverlay);
        this.container.appendChild(this.controls);
        this.container.style.touchAction = 'pan-y';

        // ── Video events (guard against multi-fire) ──────────────────
        let _readyFired = false;
        const onReady = () => {
            this._retryCount = 0;
            this.hideLoading();
            if (this._loadingTimeout) { clearTimeout(this._loadingTimeout); this._loadingTimeout = null; }
            this._restoreProgress();

            const timeDisplay = this.controls.querySelector('.time-display');
            if (timeDisplay && this.video.duration && !isNaN(this.video.duration)) {
                timeDisplay.textContent = `${this.formatTime(0)} / ${this.formatTime(this.video.duration)}`;
            }

            // Auto-unmute
            if (this.video.muted) {
                try {
                    this.video.muted = false;
                    this.video.volume = 0.5;
                    const mb = this.controls.querySelector('.mute-btn');
                    const vs = this.controls.querySelector('.volume-slider');
                    if (mb) mb.textContent = '🔉';
                    if (vs) vs.value = 0.5;
                } catch (e) { }
            }

            // Apply filter only once per playback start
            if (!_readyFired) {
                _readyFired = true;
                this._applyCurrentFilter();
            }
        };
        // Reset flag each time a new src is loaded
        this.video.addEventListener('emptied', () => { _readyFired = false; });
        this.video.addEventListener('canplay', onReady);
        this.video.addEventListener('loadeddata', onReady);
        this.video.addEventListener('loadedmetadata', onReady);

        this.video.addEventListener('error', () => {
            if (!this.video.src || this.video.src === window.location.href) return;
            if (this._retryCount < this._maxRetries) {
                this._retryCount++;
                setTimeout(() => this._retryPlayback(), this._retryCount * 2000);
            } else {
                this.hideLoading();
                this.showError();
            }
        });

        this.attachEvents();
        if (!this.lazy) this.startPlayback();
    }

    // ── Overlays ─────────────────────────────────────────────────────
    showLoading() { this.loadingOverlay.classList.remove('player-overlay-hidden'); }
    hideLoading() { this.loadingOverlay.classList.add('player-overlay-hidden'); }
    showError() { this.errorOverlay.classList.remove('player-overlay-hidden'); }
    hideError() { this.errorOverlay.classList.add('player-overlay-hidden'); }

    // ── Progress memory ───────────────────────────────────────────────
    _saveProgress() {
        if (!this.mediaItemId || !this.video.duration) return;
        const prog = JSON.parse(localStorage.getItem('videoProgress') || '{}');
        prog[this.mediaItemId] = { time: this.video.currentTime, duration: this.video.duration, updatedAt: Date.now() };
        const keys = Object.keys(prog);
        if (keys.length > 200) {
            keys.sort((a, b) => prog[a].updatedAt - prog[b].updatedAt)
                .slice(0, keys.length - 200).forEach(k => delete prog[k]);
        }
        localStorage.setItem('videoProgress', JSON.stringify(prog));
    }

    _restoreProgress() {
        if (!this.mediaItemId) return;
        const saved = JSON.parse(localStorage.getItem('videoProgress') || '{}')?.[this.mediaItemId];
        if (saved && saved.time > 2 && saved.time < (saved.duration - 2)) {
            this.video.currentTime = saved.time;
        }
    }

    // ── Retry ─────────────────────────────────────────────────────────
    async _retryPlayback() {
        this.showLoading(); this.hideError();
        if (this.isBlob) {
            this.video.src = this.videoUrl; this.video.load(); this.video.play().catch(() => { }); return;
        }
        if (this.mediaItemId) {
            try {
                const { default: API } = await import('./api.js');
                const fresh = await API.getVideo(this.mediaItemId);
                if (fresh?.baseUrl) {
                    this.videoUrl = fresh.baseUrl;
                    this.video.src = `${fresh.baseUrl}=dv`;
                    this.video.load(); this.video.play().catch(() => { }); return;
                }
            } catch (e) { }
        }
        this.video.src = `${this.videoUrl}=dv&_t=${Date.now()}`;
        this.video.load(); this.video.play().catch(() => { });
    }

    // ── Playback lifecycle ────────────────────────────────────────────
    startPlayback() {
        this._started = true;
        this.showLoading();
        this.video.src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;
        this.video.preload = 'auto';
        this.video.load();
        this.video.play().catch(() => { });
        if (this._loadingTimeout) clearTimeout(this._loadingTimeout);
        this._loadingTimeout = setTimeout(() => { this.hideLoading(); this._loadingTimeout = null; }, 5000);
    }

    activate() {
        if (this._started) {
            this.video.play().catch(() => { });
        } else if (this._preloaded) {
            this._started = true;
            this.hideLoading();
            this.video.play().catch(() => { });
        } else {
            this.startPlayback();
        }
        // Resume delay loop if Ghost Trail is active and loop was stopped
        if (this._filters[this._filterIndex]?.delay && !this._delayRunning) {
            this._startDelayLoop();
        }
    }

    preload() {
        if (this._started || this._preloaded) return;
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn?.saveData || ['slow-2g', '2g'].includes(conn?.effectiveType)) return;
        this._preloaded = true;
        this.video.src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;
        this.video.preload = 'auto';
        this.video.load();
    }

    deactivate() {
        this._saveProgress();
        this.video.pause();
        this._stopDelayLoop(/* keep canvas */ true);
    }

    // ── Events ────────────────────────────────────────────────────────
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
        const delayRow = this.controls.querySelector('.delay-strength-row');
        const delaySlider = this.controls.querySelector('.delay-strength-slider');
        const delayLabel = this.controls.querySelector('.delay-strength-label');

        // Init slider
        delaySlider.value = this._delayStrength;
        delayLabel.textContent = `${Math.round(this._delayStrength * 100)}%`;

        // Show slider if Ghost Trail already selected
        if (this._filters[this._filterIndex]?.delay) delayRow.style.display = 'flex';

        // ── Play / Pause ──────────────────────────────────────────────
        const togglePlay = () => {
            if (this.video.paused) { this.video.play(); playBtn.textContent = '⏸'; this.isPlaying = true; }
            else { this.video.pause(); playBtn.textContent = '▶'; this.isPlaying = false; }
        };
        playBtn.onclick = togglePlay;
        this.video.onclick = togglePlay;

        // ── Mute ──────────────────────────────────────────────────────
        muteBtn.onclick = () => {
            this.video.muted = !this.video.muted;
            if (!this.video.muted && this.video.volume === 0) this.video.volume = 1;
            muteBtn.textContent = this.video.muted ? '🔇' : (this.video.volume > 0.5 ? '🔊' : '🔉');
            volumeSlider.value = this.video.muted ? 0 : this.video.volume;
        };
        volumeSlider.oninput = (e) => {
            const vol = parseFloat(e.target.value);
            this.video.volume = vol; this.video.muted = vol === 0;
            muteBtn.textContent = vol === 0 ? '🔇' : (vol > 0.5 ? '🔊' : '🔉');
        };

        // ── Time update ───────────────────────────────────────────────
        let saveCounter = 0;
        this.video.ontimeupdate = () => {
            if (!this.video.duration) return;
            const pct = (this.video.currentTime / this.video.duration) * 100;
            progressFill.style.width = `${pct}%`;
            timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
            if (!this.video.paused && playBtn.textContent !== '⏸') { playBtn.textContent = '⏸'; this.isPlaying = true; }
            if (++saveCounter % 25 === 0) this._saveProgress();
        };

        // ── Buffer ────────────────────────────────────────────────────
        this.video.onprogress = () => {
            if (this.video.buffered.length > 0 && this.video.duration) {
                const end = this.video.buffered.end(this.video.buffered.length - 1);
                progressBuffered.style.width = `${(end / this.video.duration) * 100}%`;
            }
        };

        // ── Ended ─────────────────────────────────────────────────────
        this.video.onended = () => {
            playBtn.textContent = '▶'; this.isPlaying = false; this._saveProgress();
            this.container.dispatchEvent(new CustomEvent('videoEnded', { bubbles: true }));
        };

        // ── Seek (mouse + touch) ──────────────────────────────────────
        const seekTo = (clientX) => {
            if (!this.video.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            this.video.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * this.video.duration;
        };
        progressContainer.addEventListener('click', (e) => seekTo(e.clientX));
        progressContainer.addEventListener('touchstart', (e) => { e.preventDefault(); seekTo(e.touches[0].clientX); }, { passive: false });
        progressContainer.addEventListener('touchmove', (e) => { e.preventDefault(); seekTo(e.touches[0].clientX); }, { passive: false });

        // ── Fullscreen ────────────────────────────────────────────────
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
            else document.exitFullscreen();
        };

        // ── PiP ───────────────────────────────────────────────────────
        pipBtn.onclick = async () => {
            try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture();
                else if (document.pictureInPictureEnabled) await this.video.requestPictureInPicture();
            } catch (e) { }
        };

        // ── Loop ──────────────────────────────────────────────────────
        loopBtn.style.opacity = this.video.loop ? '1' : '0.5';
        loopBtn.onclick = () => { this.video.loop = !this.video.loop; loopBtn.style.opacity = this.video.loop ? '1' : '0.5'; };

        // ── Filter ────────────────────────────────────────────────────
        filterBtn.onclick = () => {
            this._filterIndex = (this._filterIndex + 1) % this._filters.length;
            localStorage.setItem('playerFilterIndex', this._filterIndex);
            this._applyCurrentFilter();
            const isDelay = !!this._filters[this._filterIndex]?.delay;
            delayRow.style.display = isDelay ? 'flex' : 'none';
        };

        // ── Ghost Trail slider ────────────────────────────────────────
        delaySlider.oninput = (e) => {
            this._delayStrength = parseFloat(e.target.value);
            localStorage.setItem('playerDelayStrength', this._delayStrength);
            delayLabel.textContent = `${Math.round(this._delayStrength * 100)}%`;
            // Update alpha live without restarting the loop
            this._delayFadeAlpha = this._strengthToAlpha(this._delayStrength);
        };

        // ── Cinema ────────────────────────────────────────────────────
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
                cinemaBtn.style.color = '#ffd700';
            } else {
                if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 400); }
                this.container.style.zIndex = '';
                cinemaBtn.style.color = '';
            }
        };

        // ── Zoom ──────────────────────────────────────────────────────
        const zoomLevels = [1, 1.5, 2, 3]; let zoomIdx = 0;
        zoomBtn.onclick = () => {
            zoomIdx = (zoomIdx + 1) % zoomLevels.length;
            this._zoomLevel = zoomLevels[zoomIdx];
            this._panX = 0; this._panY = 0;
            this._applyZoom();
            zoomBtn.textContent = this._zoomLevel > 1 ? `🔍${this._zoomLevel}x` : '🔍';
        };
        this.container.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return; e.preventDefault();
            this._zoomLevel = Math.max(1, Math.min(5, this._zoomLevel + (e.deltaY > 0 ? -0.25 : 0.25)));
            if (this._zoomLevel <= 1) { this._panX = 0; this._panY = 0; }
            this._applyZoom();
        }, { passive: false });
        let isDragging = false, dStartX, dStartY, pStartX, pStartY;
        this.video.addEventListener('mousedown', (e) => {
            if (this._zoomLevel > 1) { isDragging = true; dStartX = e.clientX; dStartY = e.clientY; pStartX = this._panX; pStartY = this._panY; e.preventDefault(); }
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging && this._zoomLevel > 1) { this._panX = pStartX + (e.clientX - dStartX); this._panY = pStartY + (e.clientY - dStartY); this._applyZoom(); }
        });
        document.addEventListener('mouseup', () => { isDragging = false; });

        // ── Download ──────────────────────────────────────────────────
        downloadBtn.onclick = () => {
            const a = document.createElement('a'); a.href = this.video.src;
            a.download = `video_${Date.now()}.mp4`; a.target = '_blank';
            document.body.appendChild(a); a.click(); a.remove();
        };

        // ── Speed ─────────────────────────────────────────────────────
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]; let speedIdx = 2;
        speedBtn.onclick = () => {
            speedIdx = (speedIdx + 1) % speeds.length;
            this.video.playbackRate = speeds[speedIdx];
            speedBtn.textContent = `${speeds[speedIdx]}x`;
        };

        // ── Keyboard ──────────────────────────────────────────────────
        this._keyHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key.toLowerCase()) {
                case ' ': case 'k': e.preventDefault(); togglePlay(); break;
                case 'f': e.preventDefault(); fullscreenBtn.click(); break;
                case 'm': e.preventDefault(); muteBtn.click(); break;
                case 'l': e.preventDefault(); loopBtn.click(); break;
                case 'v': e.preventDefault(); filterBtn.click(); break;
                case 'c': e.preventDefault(); cinemaBtn.click(); break;
                case 'z': e.preventDefault(); zoomBtn.click(); break;
                case 'd': e.preventDefault(); downloadBtn.click(); break;
                case 'j': e.preventDefault(); this.video.currentTime = Math.max(0, this.video.currentTime - 10); break;
                case ';': e.preventDefault(); this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 10); break;
                case 'arrowleft': e.preventDefault(); this.video.currentTime = Math.max(0, this.video.currentTime - 5); break;
                case 'arrowright': e.preventDefault(); this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5); break;
                case 'arrowup': e.preventDefault(); this.video.volume = Math.min(1, this.video.volume + 0.1); volumeSlider.value = this.video.volume; break;
                case 'arrowdown': e.preventDefault(); this.video.volume = Math.max(0, this.video.volume - 0.1); volumeSlider.value = this.video.volume; break;
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        // ── Auto-hide controls ─────────────────────────────────────────
        this.container.onmousemove = () => {
            this.controls.style.opacity = '1';
            clearTimeout(this.hideControlsTimer);
            this.hideControlsTimer = setTimeout(() => { if (this.isPlaying) this.controls.style.opacity = '0'; }, 3000);
        };
    }

    _applyZoom() {
        this.video.style.transform = `scale(${this._zoomLevel}) translate(${this._panX / this._zoomLevel}px, ${this._panY / this._zoomLevel}px)`;
    }

    // ── Apply current filter ──────────────────────────────────────────
    _applyCurrentFilter() {
        const f = this._filters[this._filterIndex];
        this.video.style.filter = f.css;
        const btn = this.controls?.querySelector('.filter-btn');
        if (btn) btn.title = `Filtre: ${f.name}`;

        if (f.delay) {
            // Start Ghost Trail (stops any existing loop first)
            this._setupDelayCanvas();
            this._startDelayLoop();
        } else {
            // Remove Ghost Trail
            this._stopDelayLoop(false);
            this._removeDelayCanvas();
            this.video.style.opacity = '1';
        }
    }

    // ── Ghost Trail implementation ────────────────────────────────────
    // strength → fadeAlpha : 0 = longest trail,  1 = shortest trail
    _strengthToAlpha(strength) {
        return 0.01 + strength * 0.49; // 0.01 … 0.50
    }

    _setupDelayCanvas() {
        // Remove existing canvas if any
        this._removeDelayCanvas();

        const canvas = document.createElement('canvas');
        canvas.className = 'delay-canvas';
        canvas.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'z-index:2',
            'display:block',
        ].join(';');

        // Insert before controls so controls stay on top
        this.container.insertBefore(canvas, this.controls);
        this._delayCanvas = canvas;
        this._delayCtx = canvas.getContext('2d', { willReadFrequently: false, alpha: false });
        this._delayFadeAlpha = this._strengthToAlpha(this._delayStrength);
        this._delayCW = 0; this._delayCH = 0;

        // Hide the native video element — canvas replaces it visually
        this.video.style.opacity = '0';
    }

    _removeDelayCanvas() {
        if (this._delayCanvas) {
            if (this._delayCanvas.parentNode) this._delayCanvas.remove();
            this._delayCanvas = null;
            this._delayCtx = null;
        }
    }

    _startDelayLoop() {
        if (this._delayRunning) return; // already running
        if (!this._delayCanvas) return; // no canvas
        this._delayRunning = true;

        const canvas = this._delayCanvas;
        const loop = () => {
            if (!this._delayRunning) return; // stopped externally
            this._rafId = requestAnimationFrame(loop);

            const ctx = this._delayCtx;
            if (!ctx) return;

            // Skip drawing while paused or not ready — keep RAF alive
            if (this.video.paused || this.video.readyState < 2) return;

            const vw = this.video.videoWidth || 640;
            const vh = this.video.videoHeight || 360;

            // Resize canvas only when dimensions change
            if (this._delayCW !== vw || this._delayCH !== vh) {
                this._delayCW = vw; this._delayCH = vh;
                canvas.width = vw; canvas.height = vh;
                // Fill black so trail starts cleanly
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, vw, vh);
            }

            const alpha = this._delayFadeAlpha;

            // 1. Fade existing content → creates the ghost trail
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, vw, vh);

            // 2. Draw current video frame on top
            ctx.globalAlpha = 0.92;
            ctx.drawImage(this.video, 0, 0, vw, vh);
            ctx.globalAlpha = 1;
        };

        this._rafId = requestAnimationFrame(loop);
    }

    _stopDelayLoop(keepCanvas = false) {
        this._delayRunning = false;
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        if (!keepCanvas) {
            this._removeDelayCanvas();
            if (this.video) this.video.style.opacity = '1';
        }
    }

    // ── Format time ───────────────────────────────────────────────────
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ── Destroy ───────────────────────────────────────────────────────
    destroy() {
        this._saveProgress();
        this._stopDelayLoop(false);
        const cin = document.getElementById('cinema-overlay');
        if (cin) cin.remove();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        clearTimeout(this.hideControlsTimer);
        clearTimeout(this._loadingTimeout);
        if (this.video) {
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
        }
    }
}
