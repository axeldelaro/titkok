export default class Player {
    constructor(container, videoUrl, posterUrl, options = {}) {
        this.container = container;
        this.videoUrl = videoUrl;
        this.posterUrl = posterUrl;
        this.video = null;
        this.controls = null;
        this.isPlaying = false;
        this.hideControlsTimer = null;
        // If true, don't auto-play on construction (feed uses IntersectionObserver)
        this.lazy = options.lazy === true;
        this.isBlob = this.videoUrl && this.videoUrl.startsWith('blob:');

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
        this.video.muted = true;  // Required for mobile autoplay
        this.video.playsInline = true;
        this.video.controls = false;
        this.video.loop = true;
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('muted', '');

        // ── Loading Overlay (hidden via class) ──────────────────
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'player-loading-overlay player-overlay-hidden';
        this.loadingOverlay.innerHTML = `
            <div class="player-spinner"></div>
            <span>Loading video…</span>
        `;

        // ── Error Overlay ───────────────────────────────────────
        this.errorOverlay = document.createElement('div');
        this.errorOverlay.className = 'player-error-overlay player-overlay-hidden';
        this.errorOverlay.innerHTML = `
            <span style="font-size:2.5rem;">⚠️</span>
            <p style="margin:0.5rem 0;">Video could not be loaded</p>
            <p style="font-size:0.8rem;color:var(--text-secondary,#aaa);margin-bottom:1rem;">The URL may have expired or the video is unavailable.</p>
            <button class="player-retry-btn">🔄 Retry</button>
        `;

        // Retry button
        this.errorOverlay.querySelector('.player-retry-btn').onclick = () => {
            this.hideError();
            this.showLoading();
            this.video.src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv&_t=${Date.now()}`;
            this.video.load();
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
                <button class="speed-btn" title="Playback speed">1x</button>
                <button class="pip-btn" title="Picture-in-Picture">⧉</button>
                <button class="fullscreen-btn" title="Fullscreen (F)">⛶</button>
            </div>
        `;

        // ── Build DOM ───────────────────────────────────────────
        this.container.appendChild(this.video);
        this.container.appendChild(this.loadingOverlay);
        this.container.appendChild(this.errorOverlay);
        this.container.appendChild(this.controls);
        this.container.style.touchAction = 'pan-y';

        // ── Video Events ────────────────────────────────────────
        this.video.addEventListener('canplay', () => this.hideLoading());
        this.video.addEventListener('playing', () => this.hideLoading());
        this.video.addEventListener('error', () => {
            if (this.video.src && this.video.networkState === 3) {
                this.hideLoading();
                this.showError();
                console.error('Video load error:', this.video.error);
            }
        });

        this.attachEvents();

        // ── If not lazy, start playing immediately ──────────────
        if (!this.lazy) {
            this.startPlayback();
        }
    }

    // Show/hide helpers using class toggle (not inline style)
    showLoading() {
        this.loadingOverlay.classList.remove('player-overlay-hidden');
    }
    hideLoading() {
        this.loadingOverlay.classList.add('player-overlay-hidden');
    }
    showError() {
        this.errorOverlay.classList.remove('player-overlay-hidden');
    }
    hideError() {
        this.errorOverlay.classList.add('player-overlay-hidden');
    }

    // Set src and play — used by both lazy and non-lazy paths
    startPlayback() {
        this.showLoading();
        // Blob URLs are local — don't append =dv
        this.video.src = this.isBlob ? this.videoUrl : `${this.videoUrl}=dv`;
        this.video.preload = 'auto';
        this.video.load();
        this.video.play().catch(() => { });
    }

    // Called by IntersectionObserver when visible
    activate() {
        if (!this.video.src || this.video.src === window.location.href) {
            // Not loaded yet — start playback
            this.startPlayback();
        } else {
            // Already loaded — just resume
            this.video.play().catch(() => { });
        }
    }

    // Called when scrolled out of view
    deactivate() {
        this.video.pause();
    }

    attachEvents() {
        const playBtn = this.controls.querySelector('.play-btn');
        const muteBtn = this.controls.querySelector('.mute-btn');
        const volumeSlider = this.controls.querySelector('.volume-slider');
        const fullscreenBtn = this.controls.querySelector('.fullscreen-btn');
        const pipBtn = this.controls.querySelector('.pip-btn');
        const speedBtn = this.controls.querySelector('.speed-btn');
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
        this.video.onclick = togglePlay;

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

        // Time Update
        this.video.ontimeupdate = () => {
            if (!this.video.duration) return;
            const percent = (this.video.currentTime / this.video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
            // Update play button state
            if (!this.video.paused && playBtn.textContent !== '⏸') {
                playBtn.textContent = '⏸';
                this.isPlaying = true;
            }
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
        };

        // Seek
        progressContainer.onclick = (e) => {
            if (!this.video.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.video.currentTime = pos * this.video.duration;
        };

        // Fullscreen
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) {
                this.container.requestFullscreen().catch(() => { });
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

        // Speed control
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        let currentSpeedIndex = 2;
        speedBtn.onclick = () => {
            currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
            this.video.playbackRate = speeds[currentSpeedIndex];
            speedBtn.textContent = `${speeds[currentSpeedIndex]}x`;
        };

        // Keyboard shortcuts
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

        // Auto-hide controls (desktop — mobile always visible via CSS)
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
