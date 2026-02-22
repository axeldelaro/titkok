// Player — DOM-Based Motion Trail (Mobile Safe), 3 optional CSS filters
export default class Player {
    constructor(container, videoUrl, posterUrl, options = {}) {
        this.container = container;
        this.videoUrl = videoUrl;
        this.posterUrl = posterUrl;
        this.video = null;

        // 12 delayed clones for an extremely dense, fluid ghost trail
        this.numClones = 12;
        this.trailVideos = [];

        this.controls = null;
        this.isPlaying = false;
        this.hideControlsTimer = null;

        this.lazy = options.lazy === true;
        this.isBlob = this.videoUrl && this.videoUrl.startsWith('blob:');
        this.mediaItemId = options.mediaItemId || null;
        this._retryCount = 0;
        this._maxRetries = 3;

        // ── CSS Filters ───────────────────────────────────────────────
        this._filters = [
            { name: 'Normal', css: 'none' },
            { name: 'Lèvres', css: 'saturate(3) hue-rotate(-20deg) contrast(1.1)' },
            { name: 'Inversion', css: 'invert(1) hue-rotate(180deg)' },
        ];
        this._filterIndex = parseInt(localStorage.getItem('playerFilterIndex') || '0', 10);
        if (this._filterIndex >= this._filters.length) this._filterIndex = 0;

        // ── Motion Trail strength ─────────────────────────────────────
        // 0.0 (slider left)  → 0 clones active, purely normal video
        // 1.0 (slider right) → 12 clones active, spaced out, long heavy trail
        this._trailStrength = 1.0;
        localStorage.setItem('trailStrength', '1');

        // ── Zoom / Cinema ─────────────────────────────────────────────
        this._zoomLevel = 1;
        this._panX = 0;
        this._panY = 0;

        // ── Trail synchronization ─────────────────────────────────────
        this._trailSyncInterval = null;

        this.init();
    }

    // ─── Build DOM ────────────────────────────────────────────────────
    init() {
        this.container.innerHTML = '';
        this.container.className = 'player-wrapper';
        this.container.style.backgroundColor = '#000';

        // 1. Trail Videos (Background clones)
        for (let i = 0; i < this.numClones; i++) {
            const clone = document.createElement('video');
            clone.muted = true;
            clone.playsInline = true;
            clone.controls = false;
            clone.loop = true;
            clone.setAttribute('playsinline', '');
            clone.setAttribute('webkit-playsinline', '');
            clone.setAttribute('muted', '');
            clone.style.cssText = [
                'position:absolute', 'inset:0',
                'width:100%', 'height:100%',
                'object-fit:contain',
                'pointer-events:none',
                'z-index:1',
                'opacity:0', // Dynamically updated by slider
                'transition:opacity 0.2s',
                // Default blend mode for glowing effect
                'mix-blend-mode:screen'
            ].join(';');
            this.trailVideos.push(clone);
            this.container.appendChild(clone);
        }

        // 2. Main Video (Foreground)
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
            'object-fit:contain',
            'z-index:2',
            'touch-action:pan-y',
            'opacity:0.85', // Semi-transparent to let trail bleed through
            'transition:opacity 0.2s',
        ].join(';');
        this.container.appendChild(this.video);

        // Loading overlay
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'player-loading-overlay player-overlay-hidden';
        this.loadingOverlay.style.zIndex = '3';
        this.loadingOverlay.innerHTML = '<div class="player-spinner"></div><span>Loading…</span>';
        this.container.appendChild(this.loadingOverlay);

        // Error overlay
        this.errorOverlay = document.createElement('div');
        this.errorOverlay.className = 'player-error-overlay player-overlay-hidden';
        this.errorOverlay.style.zIndex = '3';
        this.errorOverlay.innerHTML = `
            <span style="font-size:2.5rem">⚠️</span>
            <p style="margin:0.5rem 0">Video could not be loaded</p>
            <button class="player-retry-btn">🔄 Retry</button>`;
        this.errorOverlay.querySelector('.player-retry-btn').onclick = () => {
            this._retryCount = 0; this.hideError(); this._retryPlayback();
        };
        this.container.appendChild(this.errorOverlay);

        // Controls
        this.controls = document.createElement('div');
        this.controls.className = 'player-controls';
        this.controls.style.zIndex = '4';
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
        this.container.appendChild(this.controls);
        this.container.style.touchAction = 'pan-y';

        // Apply initial CSS filter
        this._applyCssFilter();

        // ── Video events ───────────────────────────────────────────────
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
            this._syncTrailVideo();
        };

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

        // Keep the trail videos strictly synced when main video plays
        this.video.addEventListener('play', () => {
            this._syncTrailVideo();
        });
        this.video.addEventListener('pause', () => {
            this.trailVideos.forEach(v => v.pause());
        });
        this.video.addEventListener('seeked', () => {
            this._syncTrailVideo();
        });

        this.attachEvents();
        if (!this.lazy) this.startPlayback();
    }

    _applyCssFilter() {
        const cssFilter = this._filters[this._filterIndex].css;
        const filterStr = cssFilter === 'none' ? '' : cssFilter;
        this.video.style.filter = filterStr;
        this.trailVideos.forEach(v => v.style.filter = filterStr);
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
        const src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;

        if (this.mediaItemId) {
            try {
                const { default: API } = await import('./api.js');
                const fresh = await API.getVideo(this.mediaItemId);
                if (fresh?.baseUrl) {
                    this.videoUrl = fresh.baseUrl;
                    const fsrc = `${fresh.baseUrl}=dv`;
                    this.video.src = fsrc;
                    this.trailVideos.forEach(v => v.src = fsrc);

                    this.video.load();
                    this.trailVideos.forEach(v => v.load());

                    this.video.play().catch(() => { });
                    return;
                }
            } catch (e) { }
        }

        const fallbackSrc = `${src}&_t=${Date.now()}`;
        this.video.src = fallbackSrc;
        this.trailVideos.forEach(v => v.src = fallbackSrc);

        this.video.load();
        this.trailVideos.forEach(v => v.load());

        this.video.play().catch(() => { });
    }

    // ── Playback lifecycle ─────────────────────────────────────────────
    startPlayback() {
        this._started = true;
        this.showLoading();

        const src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;
        this.video.src = src;
        this.trailVideos.forEach(v => v.src = src);

        this.video.preload = 'auto';
        this.trailVideos.forEach(v => v.preload = 'auto');

        this.video.load();
        this.trailVideos.forEach(v => v.load());

        this.video.play().catch(() => { });
        this.trailVideos.forEach(v => v.play().catch(() => { }));

        this._updateTrailVisuals();

        if (this._loadingTimeout) clearTimeout(this._loadingTimeout);
        this._loadingTimeout = setTimeout(() => { this.hideLoading(); this._loadingTimeout = null; }, 5000);

        this._startSyncLoop();
    }

    activate() {
        if (this._started) { this.video.play().catch(() => { }); }
        else if (this._preloaded) { this._started = true; this.hideLoading(); this.video.play().catch(() => { }); }
        else { this.startPlayback(); }
        this._startSyncLoop();
    }

    preload() {
        if (this._started || this._preloaded) return;
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn?.saveData || ['slow-2g', '2g'].includes(conn?.effectiveType)) return;
        this._preloaded = true;

        const src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;
        this.video.src = src;
        this.trailVideos.forEach(v => v.src = src);

        this.video.preload = 'auto';
        this.trailVideos.forEach(v => v.preload = 'auto');

        this.video.load();
        this.trailVideos.forEach(v => v.load());
    }

    deactivate() {
        this._saveProgress();
        this.video.pause();
        this.trailVideos.forEach(v => v.pause());
        this._stopSyncLoop();
    }

    // ─── MULTI-CLONE TRAIL SYNC ───────────────────────────────────────

    _updateTrailVisuals() {
        const s = this._trailStrength;

        if (s === 0) {
            this.video.style.opacity = '1';
            this.trailVideos.forEach(v => v.style.opacity = '0');
            return;
        }

        // As strength increases, main video becomes quite transparent (down to 0.6 at 100%)
        // This is crucial so the bright clones behind it aren't hidden by the foreground
        this.video.style.opacity = (0.95 - (s * 0.35)).toString();

        const activeClones = Math.max(1, Math.round(s * this.numClones));

        // Base opacity for the clones is much higher now
        const baseOpacity = 0.4 + (s * 0.55); // up to 0.95 opacity for the nearest clone

        for (let i = 0; i < this.numClones; i++) {
            const clone = this.trailVideos[i];

            if (i < activeClones) {
                // Slower decay so the trail stays thick for longer.
                // At 12 clones, i=11 means 11 * 0.07 = 0.77 drop (still ~20% visible at the very end)
                const decay = 1 - (i * 0.07);
                const finalOpacity = Math.max(0, baseOpacity * decay);
                clone.style.opacity = finalOpacity.toString();
            } else {
                clone.style.opacity = '0';
            }
        }
    }

    _syncTrailVideo(forceSnap = false) {
        if (this.video.readyState < 2) return;

        const s = this._trailStrength;
        // 12 clones: max gap is slightly smaller to keep them tightly linked
        // gap range: 0.01s to 0.035s per clone (total trail length up to ~0.4s)
        const gap = 0.01 + (s * 0.025);
        const isPaused = this.video.paused;

        for (let i = 0; i < this.numClones; i++) {
            const clone = this.trailVideos[i];
            if (clone.style.opacity === '0' || clone.readyState < 2) continue;

            const targetDelay = gap * (i + 1);

            // Startup phase fix:
            // If the main video hasn't reached the delay time for this clone, hold it at 0.
            if (this.video.currentTime <= targetDelay) {
                if (!clone.paused) clone.pause();
                if (clone.currentTime > 0.05) clone.currentTime = 0;
                continue; // Wait until the main video is far enough ahead
            }

            const targetTime = this.video.currentTime - targetDelay;

            const drift = Math.abs(clone.currentTime - targetTime);

            if (forceSnap || drift > 0.4 || (isPaused && drift > 0.05)) {
                clone.currentTime = targetTime;
            } else if (!isPaused) {
                // Soft sync via playback rate (catch up or slow down slightly)
                // This is much smoother than seeking
                if (drift > 0.05) {
                    if (clone.currentTime < targetTime) {
                        clone.playbackRate = this.video.playbackRate * 1.05; // speed up
                    } else {
                        clone.playbackRate = this.video.playbackRate * 0.95; // slow down
                    }
                } else {
                    clone.playbackRate = this.video.playbackRate;
                }
            }

            // Ensure they are playing if the main video is playing
            if (!isPaused && clone.paused) {
                clone.play().catch(() => { });
            }
        }
    }

    _startSyncLoop() {
        if (this._trailSyncInterval) return;
        this._trailSyncInterval = setInterval(() => this._syncTrailVideo(), 100);
    }

    _stopSyncLoop() {
        if (this._trailSyncInterval) {
            clearInterval(this._trailSyncInterval);
            this._trailSyncInterval = null;
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

        trailSlider.value = this._trailStrength;
        trailLabel.textContent = `${Math.round(this._trailStrength * 100)}%`;

        // ── Play / Pause ──────────────────────────────────────────────
        const togglePlay = () => {
            if (this.video.paused) {
                this.video.play();
                this.trailVideos.forEach(v => v.play().catch(() => { }));
                playBtn.textContent = '⏸';
                this.isPlaying = true;
            } else {
                this.video.pause();
                this.trailVideos.forEach(v => v.pause());
                playBtn.textContent = '▶';
                this.isPlaying = false;
            }
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
            this._syncTrailVideo();
        };
        progressContainer.addEventListener('click', (e) => seekTo(e.clientX));
        progressContainer.addEventListener('touchstart', (e) => { e.preventDefault(); seekTo(e.touches[0].clientX); }, { passive: false });
        progressContainer.addEventListener('touchmove', (e) => { e.preventDefault(); seekTo(e.touches[0].clientX); }, { passive: false });

        // ── Trail slider ──────────────────────────────────────────────
        trailSlider.oninput = (e) => {
            this._trailStrength = parseFloat(e.target.value);
            localStorage.setItem('trailStrength', this._trailStrength);
            trailLabel.textContent = `${Math.round(this._trailStrength * 100)}%`;
            this._updateTrailVisuals();
            this._syncTrailVideo(true); // Snap instantly when slider moves
        };

        // ── Filter ────────────────────────────────────────────────────
        filterBtn.onclick = () => {
            this._filterIndex = (this._filterIndex + 1) % this._filters.length;
            localStorage.setItem('playerFilterIndex', this._filterIndex);
            this._applyCssFilter();
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
        loopBtn.onclick = () => {
            this.video.loop = !this.video.loop;
            this.trailVideos.forEach(v => v.loop = this.video.loop);
            loopBtn.style.opacity = this.video.loop ? '1' : '0.5';
        };

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
        speedBtn.onclick = () => {
            speedIdx = (speedIdx + 1) % speeds.length;
            const rate = speeds[speedIdx];
            this.video.playbackRate = rate;
            this.trailVideos.forEach(v => v.playbackRate = rate);
            speedBtn.textContent = `${rate}×`;
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
                case 'arrowleft': e.preventDefault(); this.video.currentTime = Math.max(0, this.video.currentTime - 5); this._syncTrailVideo(); break;
                case 'arrowright': e.preventDefault(); this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5); this._syncTrailVideo(); break;
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
        this.trailVideos.forEach(v => v.style.transform = t);
    }

    formatTime(s) {
        if (!s || isNaN(s)) return '0:00';
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    destroy() {
        this._saveProgress();
        this._stopSyncLoop();
        const cin = document.getElementById('cinema-overlay');
        if (cin) cin.remove();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        clearTimeout(this.hideControlsTimer);
        clearTimeout(this._loadingTimeout);
        if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
        this.trailVideos.forEach(v => {
            v.pause(); v.removeAttribute('src'); v.load();
        });
    }
}
