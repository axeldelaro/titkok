export default class Player {
    constructor(container, videoUrl, posterUrl) {
        this.container = container;
        this.videoUrl = videoUrl;
        this.posterUrl = posterUrl;
        this.video = null;
        this.controls = null;
        this.isPlaying = false;
        this.hideControlsTimer = null;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.className = 'player-wrapper';

        // Video Element — always set src, always start muted (mobile autoplay requirement)
        this.video = document.createElement('video');
        this.video.src = `${this.videoUrl}=dv`;
        this.video.poster = `${this.posterUrl}=w1920-h1080`;
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.backgroundColor = '#000';
        this.video.style.touchAction = 'pan-y';        // Allow swipe scrolling
        this.video.preload = 'metadata';                // Light: gets dimensions + duration without full download
        this.video.muted = true;                        // MUST be muted for mobile autoplay
        this.video.playsInline = true;
        this.video.controls = false;
        this.video.loop = true;

        // Explicit HTML attributes for maximum browser compat
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('muted', '');

        // Loading Spinner Overlay — hidden by default, shown in activate()
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'player-loading-overlay';
        this.loadingOverlay.style.display = 'none';
        this.loadingOverlay.innerHTML = `
            <div class="player-spinner"></div>
            <span>Loading video…</span>
        `;

        // Error Overlay
        this.errorOverlay = document.createElement('div');
        this.errorOverlay.className = 'player-error-overlay';
        this.errorOverlay.style.display = 'none';
        this.errorOverlay.innerHTML = `
            <span style="font-size:2.5rem;">⚠️</span>
            <p style="margin:0.5rem 0;">Video could not be loaded</p>
            <p style="font-size:0.8rem;color:var(--text-secondary,#aaa);margin-bottom:1rem;">The URL may have expired or the video is unavailable.</p>
            <button class="player-retry-btn">🔄 Retry</button>
        `;

        // Hide loading when video is ready — handled in activate()
        // (we don't set the listener here because canplay may fire before overlay is in DOM)

        // Show error overlay on failure — but NOT for initial empty states
        this.video.addEventListener('error', () => {
            // Only show error if we actually have a src set
            if (this.video.src && this.video.src !== window.location.href) {
                this.loadingOverlay.style.display = 'none';
                this.errorOverlay.style.display = 'flex';
                console.error('Video load error:', this.video.error);
            }
        });

        // Retry button
        this.errorOverlay.querySelector('.player-retry-btn').onclick = () => {
            this.errorOverlay.style.display = 'none';
            this.loadingOverlay.style.display = '';
            const bust = `&_t=${Date.now()}`;
            this.video.src = `${this.videoUrl}=dv${bust}`;
            this.video.load();
            // Re-listen for canplay after retry
            this.video.addEventListener('canplay', () => {
                this.loadingOverlay.style.display = 'none';
            }, { once: true });
        };

        // Custom Controls Overlay
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

        this.container.appendChild(this.video);
        // NOTE: loadingOverlay is NOT added here — only added in activate()
        this.container.appendChild(this.errorOverlay);
        this.container.appendChild(this.controls);

        this.container.style.touchAction = 'pan-y';

        this.attachEvents();
    }

    // Called by IntersectionObserver when the player scrolls into view
    activate() {
        // Insert loading overlay
        if (!this.loadingOverlay.parentNode) {
            this.container.insertBefore(this.loadingOverlay, this.errorOverlay);
        }

        // If video already has enough data, skip showing loading
        if (this.video.readyState >= 3) {
            this.loadingOverlay.style.display = 'none';
        } else {
            this.loadingOverlay.style.display = '';
            // Listen for canplay NOW to hide the overlay
            this.video.addEventListener('canplay', () => {
                this.loadingOverlay.style.display = 'none';
            }, { once: true });
        }

        this.video.preload = 'auto';
        this.video.play().catch(() => { });
    }

    // Called when the player scrolls out of view
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

        // Mute Toggle — also unmutes with volume
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
            if (vol === 0) {
                muteBtn.textContent = '🔇';
            } else if (vol > 0.5) {
                muteBtn.textContent = '🔊';
            } else {
                muteBtn.textContent = '🔉';
            }
        };

        // Time Update
        this.video.ontimeupdate = () => {
            const percent = (this.video.currentTime / this.video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
        };

        // Buffer progress
        this.video.onprogress = () => {
            if (this.video.buffered.length > 0) {
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
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.video.currentTime = pos * this.video.duration;
        };

        // Fullscreen
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) {
                this.container.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        };

        // PIP
        pipBtn.onclick = async () => {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                await this.video.requestPictureInPicture();
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
                    if (!document.fullscreenElement) {
                        this.container.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
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
                    this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 5);
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

        // Auto-hide controls (desktop only — mobile has always-visible via CSS)
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
            this.video.src = '';
        }
    }
}
