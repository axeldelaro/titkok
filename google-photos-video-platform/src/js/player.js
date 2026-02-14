export default class Player {
    constructor(container, videoUrl, posterUrl) {
        this.container = container;
        this.videoUrl = videoUrl;
        this.posterUrl = posterUrl;
        this.video = null;
        this.controls = null;
        this.isPlaying = false;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.className = 'player-wrapper';

        // Video Element
        this.video = document.createElement('video');
        this.video.src = `${this.videoUrl}=dv`; // =dv is key for Google Photos video download/stream
        this.video.poster = `${this.posterUrl}=w1920-h1080`;
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.backgroundColor = '#000';

        // Custom Controls Overlay
        this.controls = document.createElement('div');
        this.controls.className = 'player-controls';
        this.controls.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="controls-row">
                <button class="play-btn">▶</button>
                <div class="volume-container">
                    <button class="mute-btn">🔊</button>
                    <input type="range" min="0" max="1" step="0.1" value="1" class="volume-slider">
                </div>
                <span class="time-display">00:00 / 00:00</span>
                <div style="flex: 1;"></div>
                <button class="pip-btn">⧉</button>
                <button class="fullscreen-btn">⛶</button>
            </div>
            <style>
                .player-wrapper { position: relative; width: 100%; aspect-ratio: 16/9; background: black; overflow: hidden; }
                .player-controls {
                    position: absolute; bottom: 0; left: 0; right: 0;
                    background: linear-gradient(transparent, rgba(0,0,0,0.8));
                    padding: 1rem; opacity: 0; transition: opacity 0.3s;
                    display: flex; flex-direction: column; gap: 0.5rem;
                }
                .player-wrapper:hover .player-controls { opacity: 1; }
                .controls-row { display: flex; align-items: center; gap: 1rem; }
                .progress-bar-container { width: 100%; height: 5px; background: rgba(255,255,255,0.2); cursor: pointer; border-radius: 3px; }
                .progress-fill { height: 100%; width: 0%; background: var(--primary-color); border-radius: 3px; }
                button { color: white; font-size: 1.2rem; background: transparent; border: none; cursor: pointer; }
            </style>
        `;

        this.container.appendChild(this.video);
        this.container.appendChild(this.controls);

        this.attachEvents();
    }

    attachEvents() {
        const playBtn = this.controls.querySelector('.play-btn');
        const muteBtn = this.controls.querySelector('.mute-btn');
        const fullscreenBtn = this.controls.querySelector('.fullscreen-btn');
        const pipBtn = this.controls.querySelector('.pip-btn');
        const progressContainer = this.controls.querySelector('.progress-bar-container');
        const progressFill = this.controls.querySelector('.progress-fill');
        const timeDisplay = this.controls.querySelector('.time-display');

        // Play/Pause
        const togglePlay = () => {
            if (this.video.paused) {
                this.video.play();
                playBtn.textContent = '⏸';
            } else {
                this.video.pause();
                playBtn.textContent = '▶';
            }
        };

        playBtn.onclick = togglePlay;
        this.video.onclick = togglePlay;

        // Time Update
        this.video.ontimeupdate = () => {
            const percent = (this.video.currentTime / this.video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
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
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
