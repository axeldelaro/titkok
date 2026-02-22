// Player — Motion Trail always active, 3 optional CSS filters
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

        // ── CSS Filters (applied to canvas display) ──────────────────
        this._filters = [
            { name: 'Normal', css: 'none' },
            { name: 'Lèvres', css: 'saturate(3) hue-rotate(-20deg) contrast(1.1)' },
            { name: 'Inversion', css: 'invert(1) hue-rotate(180deg)' },
        ];
        this._filterIndex = parseInt(localStorage.getItem('playerFilterIndex') || '0', 10);
        if (this._filterIndex >= this._filters.length) this._filterIndex = 0;

        // ── Motion Trail strength ─────────────────────────────────────
        // Stored as 0.0 (short) → 1.0 (very long)
        this._trailStrength = Math.max(0, Math.min(1,
            parseFloat(localStorage.getItem('trailStrength') ?? '0.5')
        ));

        // ── Zoom / Cinema ─────────────────────────────────────────────
        this._zoomLevel = 1;
        this._panX = 0;
        this._panY = 0;

        // ── Trail state ───────────────────────────────────────────────
        this._trailCanvas = null;
        this._trailCtx = null;
        this._trailRunning = false;
        this._trailRaf = null;
        this._trailCW = 0;
        this._trailCH = 0;

        this.init();
    }

    // ─── Build DOM ────────────────────────────────────────────────────
    init() {
        this.container.innerHTML = '';
        this.container.className = 'player-wrapper';

        // Video element (will be hidden once trail canvas is ready)
        this.video = document.createElement('video');
        this.video.poster = this.isBlob ? '' : `${this.posterUrl}=w1920-h1080`;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.controls = false;
        this.video.loop = true;
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('muted', '');
        this.video.style.cssText = [
            'position:absolute', 'inset:0',
            'width:100%', 'height:100%',
            'object-fit:contain', 'background:#000',
            'touch-action:pan-y',
        ].join(';');

        // Trail canvas — sits on top of the video, always visible
        this._trailCanvas = document.createElement('canvas');
        this._trailCanvas.style.cssText = [
            'position:absolute', 'inset:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'z-index:2',
            'display:block',
        ].join(';');
        this._trailCtx = this._trailCanvas.getContext('2d', { alpha: false });

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
            this._retryCount = 0; this.hideError(); this._retryPlayback();
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
            <div class="trail-row" style="display:flex;align-items:center;gap:0.5rem;padding:0 0.25rem 0.25rem">
                <span style="font-size:0.75rem;white-space:nowrap;opacity:0.8">👻 Traînée</span>
                <input type="range" min="0" max="1" step="0.01" class="trail-slider" style="flex:1;accent-color:var(--primary-color,#ff4081);">
                <span class="trail-label" style="font-size:0.75rem;min-width:2.5em;text-align:right;opacity:0.8"></span>
            </div>
            <div class="controls-row">
                <button class="play-btn"            title="Play (Space)">▶</button>
                <div class="volume-container">
                    <button class="mute-btn"        title="Mute (M)">🔇</button>
                    <input type="range" min="0" max="1" step="0.05" value="0" class="volume-slider">
                </div>
                <span class="time-display">0:00 / 0:00</span>
                <div style="flex:1"></div>
                <button class="loop-btn    ctrl-btn" title="Loop (L)">🔁</button>
                <button class="filter-btn  ctrl-btn" title="Filtre (V)">🎨</button>
                <button class="cinema-btn  ctrl-btn" title="Cinema (C)">🎬</button>
                <button class="zoom-btn    ctrl-btn" title="Zoom (Z)">🔍</button>
                <button class="download-btn ctrl-btn" title="Download (D)">⬇️</button>
                <button class="speed-btn"             title="Vitesse">1×</button>
                <button class="pip-btn"               title="PiP">🖼</button>
                <button class="fullscreen-btn"        title="Fullscreen (F)">⛶</button>
            </div>`;

        // Build: video → trail canvas → overlays → controls
        this.container.appendChild(this.video);
        this.container.appendChild(this._trailCanvas);
        this.container.appendChild(this.loadingOverlay);
        this.container.appendChild(this.errorOverlay);
        this.container.appendChild(this.controls);
        this.container.style.touchAction = 'pan-y';

        // ── Video events ───────────────────────────────────────────────
        let _firstPlay = false;
        const onReady = () => {
            this.hideLoading();
            if (this._loadingTimeout) { clearTimeout(this._loadingTimeout); this._loadingTimeout = null; }
            this._retryCount = 0;
            this._restoreProgress();

            const td = this.controls.querySelector('.time-display');
            if (td && this.video.duration && !isNaN(this.video.duration)) {
                td.textContent = `${this.formatTime(0)} / ${this.formatTime(this.video.duration)}`;
            }
            // Auto-unmute
            if (this.video.muted) {
                try {
                    this.video.muted = false; this.video.volume = 0.5;
                    const mb = this.controls.querySelector('.mute-btn');
                    const vs = this.controls.querySelector('.volume-slider');
                    if (mb) mb.textContent = '🔉'; if (vs) vs.value = 0.5;
                } catch (e) { }
            }
            // Start trail on first ready-event per source
            if (!_firstPlay) { _firstPlay = true; this._startTrail(); }
        };

        this.video.addEventListener('emptied', () => { _firstPlay = false; });
        this.video.addEventListener('canplay', onReady);
        this.video.addEventListener('loadeddata', onReady);
        this.video.addEventListener('loadedmetadata', onReady);

        this.video.addEventListener('error', () => {
            if (!this.video.src || this.video.src === window.location.href) return;
            if (this._retryCount < this._maxRetries) {
                this._retryCount++;
                setTimeout(() => this._retryPlayback(), this._retryCount * 2000);
            } else { this.hideLoading(); this.showError(); }
        });

        this.attachEvents();
        if (!this.lazy) this.startPlayback();
    }

    // ── Overlays ──────────────────────────────────────────────────────
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
        if (keys.length > 200) keys.sort((a, b) => prog[a].updatedAt - prog[b].updatedAt).slice(0, keys.length - 200).forEach(k => delete prog[k]);
        localStorage.setItem('videoProgress', JSON.stringify(prog));
    }

    _restoreProgress() {
        if (!this.mediaItemId) return;
        const s = JSON.parse(localStorage.getItem('videoProgress') || '{}')?.[this.mediaItemId];
        if (s?.time > 2 && s.time < (s.duration - 2)) this.video.currentTime = s.time;
    }

    // ── Retry ─────────────────────────────────────────────────────────
    async _retryPlayback() {
        this.showLoading(); this.hideError();
        if (this.isBlob) { this.video.src = this.videoUrl; this.video.load(); this.video.play().catch(() => { }); return; }
        if (this.mediaItemId) {
            try {
                const { default: API } = await import('./api.js');
                const fresh = await API.getVideo(this.mediaItemId);
                if (fresh?.baseUrl) { this.videoUrl = fresh.baseUrl; this.video.src = `${fresh.baseUrl}=dv`; this.video.load(); this.video.play().catch(() => { }); return; }
            } catch (e) { }
        }
        this.video.src = `${this.videoUrl}=dv&_t=${Date.now()}`; this.video.load(); this.video.play().catch(() => { });
    }

    // ── Playback lifecycle ─────────────────────────────────────────────
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
        if (this._started) { this.video.play().catch(() => { }); }
        else if (this._preloaded) { this._started = true; this.hideLoading(); this.video.play().catch(() => { }); }
        else { this.startPlayback(); }
        // Restart trail loop (it was paused on deactivate)
        if (!this._trailRunning) this._startTrail();
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
        this._stopTrail(/* keepCanvas */ true); // keep the last frame frozen on canvas
    }

    // ─── MOTION TRAIL ─────────────────────────────────────────────────
    // Algorithm each frame:
    //   1. Fade canvas toward black  → dims old positions (creates trail)
    //   2. Draw current video frame at full opacity → current pos crisp
    //
    // Strength 0 (left) → short trail   (fadeRate = 0.5)
    // Strength 1 (right) → long trail   (fadeRate = 0.01)
    // ─────────────────────────────────────────────────────────────────

    _trailFadeRate() {
        // Slider right (1.0) = long trail = slow fade (0.02)
        // Slider left  (0.0) = short trail = fast fade (0.30)
        return 0.02 + (1 - this._trailStrength) * 0.28;
    }

    _startTrail() {
        this._stopTrail(true);
        this._trailCW = 0;
        this._trailCH = 0;
        this._trailRunning = true;

        // ⚠️ DO NOT hide the video with opacity:0 or visibility:hidden.
        // Mobile browsers (iOS Safari, Android Chrome) use the video's
        // visibility to decide whether to keep decoded frames available.
        // opacity:0 → browser skips rendering → drawImage() gets a black frame.
        // The opaque canvas (z-index:2) already covers the video visually.
        this.video.style.visibility = 'visible';
        this.video.style.opacity = '1';

        const canvas = this._trailCanvas;
        const ctx = this._trailCtx;

        // Apply current CSS filter to canvas (cross-browser, works on mobile)
        const cssFilter = this._filters[this._filterIndex].css;
        canvas.style.filter = cssFilter === 'none' ? '' : cssFilter;

        const tick = () => {
            if (!this._trailRunning) return;
            this._trailRaf = requestAnimationFrame(tick);

            // Skip drawing if not ready — still draw while paused
            if (this.video.readyState < 2) return;

            const vw = this.video.videoWidth;
            const vh = this.video.videoHeight;
            if (!vw || !vh) return;

            // Resize canvas on dimension change, fill black
            if (this._trailCW !== vw || this._trailCH !== vh) {
                this._trailCW = vw; this._trailCH = vh;
                canvas.width = vw; canvas.height = vh;
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, vw, vh);
            }

            const s = this._trailStrength;
            const fadeRate = 0.02 + (1 - s) * 0.28; // 0.30 (short) → 0.02 (long)
            // KEY FIX: drawAlpha MUST be < 1.0 for trail to accumulate.
            // At 1.0 the new frame overwrites everything — no trail possible.
            const drawAlpha = 1 - s * 0.5;            // 1.00 (none) → 0.50 (max)

            // 1. Fade existing content toward black
            ctx.globalAlpha = fadeRate;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, vw, vh);

            // 2. Draw new frame at drawAlpha — old positions bleed through
            ctx.globalAlpha = drawAlpha;
            ctx.drawImage(this.video, 0, 0, vw, vh);
            ctx.globalAlpha = 1;
        };

        this._trailRaf = requestAnimationFrame(tick);
    }

    _stopTrail(keepCanvas = false) {
        this._trailRunning = false;
        if (this._trailRaf) { cancelAnimationFrame(this._trailRaf); this._trailRaf = null; }
        if (!keepCanvas) {
            // Black out canvas when stopping
            if (this._trailCtx && this._trailCW && this._trailCH) {
                this._trailCtx.fillStyle = '#000';
                this._trailCtx.fillRect(0, 0, this._trailCW, this._trailCH);
            }
        }
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
        const trailSlider = this.controls.querySelector('.trail-slider');
        const trailLabel = this.controls.querySelector('.trail-label');

        // Init trail slider display
        trailSlider.value = this._trailStrength;
        trailLabel.textContent = `${Math.round(this._trailStrength * 100)}%`;

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
            const v = parseFloat(e.target.value);
            this.video.volume = v; this.video.muted = v === 0;
            muteBtn.textContent = v === 0 ? '🔇' : (v > 0.5 ? '🔊' : '🔉');
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
        this.video.onprogress = () => {
            if (this.video.buffered.length > 0 && this.video.duration) {
                const end = this.video.buffered.end(this.video.buffered.length - 1);
                progressBuffered.style.width = `${(end / this.video.duration) * 100}%`;
            }
        };
        this.video.onended = () => {
            playBtn.textContent = '▶'; this.isPlaying = false; this._saveProgress();
            this.container.dispatchEvent(new CustomEvent('videoEnded', { bubbles: true }));
        };

        // ── Seek (mouse + touch) ──────────────────────────────────────
        const seekTo = (x) => {
            if (!this.video.duration) return;
            const r = progressContainer.getBoundingClientRect();
            this.video.currentTime = Math.max(0, Math.min(1, (x - r.left) / r.width)) * this.video.duration;
        };
        progressContainer.addEventListener('click', (e) => seekTo(e.clientX));
        progressContainer.addEventListener('touchstart', (e) => { e.preventDefault(); seekTo(e.touches[0].clientX); }, { passive: false });
        progressContainer.addEventListener('touchmove', (e) => { e.preventDefault(); seekTo(e.touches[0].clientX); }, { passive: false });

        // ── Trail slider ──────────────────────────────────────────────
        trailSlider.oninput = (e) => {
            this._trailStrength = parseFloat(e.target.value);
            localStorage.setItem('trailStrength', this._trailStrength);
            trailLabel.textContent = `${Math.round(this._trailStrength * 100)}%`;
            // No loop restart needed — _trailFadeRate() reads live on next tick
        };

        // ── Filter ────────────────────────────────────────────────────
        filterBtn.onclick = () => {
            this._filterIndex = (this._filterIndex + 1) % this._filters.length;
            localStorage.setItem('playerFilterIndex', this._filterIndex);
            const cssFilter = this._filters[this._filterIndex].css;
            this._trailCanvas.style.filter = cssFilter === 'none' ? '' : cssFilter;
            filterBtn.title = `Filtre: ${this._filters[this._filterIndex].name}`;
        };

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

        // ── Cinema ────────────────────────────────────────────────────
        cinemaBtn.onclick = () => {
            let overlay = document.getElementById('cinema-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'cinema-overlay';
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999;transition:opacity 0.4s;opacity:0;pointer-events:none;';
                document.body.appendChild(overlay);
                requestAnimationFrame(() => overlay.style.opacity = '1');
                this.container.style.zIndex = '1000'; cinemaBtn.style.color = '#ffd700';
            } else {
                overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 400);
                this.container.style.zIndex = ''; cinemaBtn.style.color = '';
            }
        };

        // ── Zoom ──────────────────────────────────────────────────────
        const zoomLevels = [1, 1.5, 2, 3]; let zoomIdx = 0;
        zoomBtn.onclick = () => {
            zoomIdx = (zoomIdx + 1) % zoomLevels.length;
            this._zoomLevel = zoomLevels[zoomIdx]; this._panX = 0; this._panY = 0;
            this._applyZoom(); zoomBtn.textContent = this._zoomLevel > 1 ? `🔍${this._zoomLevel}×` : '🔍';
        };
        this.container.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return; e.preventDefault();
            this._zoomLevel = Math.max(1, Math.min(5, this._zoomLevel + (e.deltaY > 0 ? -0.25 : 0.25)));
            if (this._zoomLevel <= 1) { this._panX = 0; this._panY = 0; }
            this._applyZoom();
        }, { passive: false });
        let drag = false, dsx, dsy, psx, psy;
        this.video.addEventListener('mousedown', (e) => { if (this._zoomLevel > 1) { drag = true; dsx = e.clientX; dsy = e.clientY; psx = this._panX; psy = this._panY; e.preventDefault(); } });
        document.addEventListener('mousemove', (e) => { if (drag && this._zoomLevel > 1) { this._panX = psx + (e.clientX - dsx); this._panY = psy + (e.clientY - dsy); this._applyZoom(); } });
        document.addEventListener('mouseup', () => { drag = false; });

        // ── Download ──────────────────────────────────────────────────
        downloadBtn.onclick = () => {
            const a = document.createElement('a'); a.href = this.video.src;
            a.download = `video_${Date.now()}.mp4`; a.target = '_blank';
            document.body.appendChild(a); a.click(); a.remove();
        };

        // ── Speed ─────────────────────────────────────────────────────
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]; let speedIdx = 2;
        speedBtn.onclick = () => { speedIdx = (speedIdx + 1) % speeds.length; this.video.playbackRate = speeds[speedIdx]; speedBtn.textContent = `${speeds[speedIdx]}×`; };

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
                case 'arrowleft': e.preventDefault(); this.video.currentTime = Math.max(0, this.video.currentTime - 5); break;
                case 'arrowright': e.preventDefault(); this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5); break;
                case 'arrowup': e.preventDefault(); this.video.volume = Math.min(1, this.video.volume + 0.1); volumeSlider.value = this.video.volume; break;
                case 'arrowdown': e.preventDefault(); this.video.volume = Math.max(0, this.video.volume - 0.1); volumeSlider.value = this.video.volume; break;
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        // Auto-hide controls
        this.container.onmousemove = () => {
            this.controls.style.opacity = '1';
            clearTimeout(this.hideControlsTimer);
            this.hideControlsTimer = setTimeout(() => { if (this.isPlaying) this.controls.style.opacity = '0'; }, 3000);
        };
    }

    _applyZoom() {
        const t = `scale(${this._zoomLevel}) translate(${this._panX / this._zoomLevel}px, ${this._panY / this._zoomLevel}px)`;
        this.video.style.transform = t;
        if (this._trailCanvas) this._trailCanvas.style.transform = t;
    }

    formatTime(s) {
        if (!s || isNaN(s)) return '0:00';
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    destroy() {
        this._saveProgress();
        this._stopTrail(false);
        const cin = document.getElementById('cinema-overlay');
        if (cin) cin.remove();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        clearTimeout(this.hideControlsTimer);
        clearTimeout(this._loadingTimeout);
        if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
    }
}
