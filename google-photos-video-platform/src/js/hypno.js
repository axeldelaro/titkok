/* ── Hypnotic Popup: SUBLIMINAL MODE ──
 * Pure visual chaos — fleeting subliminal images + 46 visual effects
 * No mini-games, only passive visual hypnosis
 */
import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let hypnoActive = false;
let hypnoTimers = [];
let activePopups = new Set();
let overlayContainer = null;
// Load config from localStorage or default
const DEFAULT_CONFIG = {
    // ── Popups ──
    popupsEnabled: true,
    popupDensity: 25,
    popupSize: 1.0,
    popupSpeed: 1.0,

    // ── Visual / Chill ──
    scanlines: true,
    rgbShift: true,
    pixelate: true,
    textSubliminal: true,
    breathe: true,
    tilt: true,
    mirror: true,
    colorCycle: false,
    fadePulse: true,
    filmGrain: true,
    sepiaFlash: true,
    // ── Motion / Transform ──
    tunnel: true,
    doubleVision: true,
    verticalStretch: true,
    glitch: true,
    zoomPulse: true,
    skewHorizontal: true,
    skewVertical: true,
    wobble: true,
    heartbeat: true,
    earthquake: false,
    drunkMode: false,
    // ── Color / Filter ──
    negativeFlash: true,
    thermalVision: true,
    nightVision: true,
    redChannel: true,
    blueChannel: true,
    greenChannel: true,
    solarize: true,
    colorDrain: true,
    cyberpunk: true,
    bloodMoon: false,
    retroWave: true,
    // ── Overlay / Complex ──
    strobe: true,
    hologram: true,
    oldTV: true,
    subliminalFlash: true,
    matrixRain: true,
    speedLines: true,
    datamosh: true,
    ghostTrail: true,
    fishEye: true,
    // ── Extreme (off by default) ──
    kaleidoscope: false,
    liquidWarp: false,
    vortex: false,
    blackout: false,
    whiteout: false,
    chromaStorm: false,
};

let config = JSON.parse(localStorage.getItem('hypnoConfig') || JSON.stringify(DEFAULT_CONFIG));

export const updateConfig = (newConfig) => {
    config = { ...config, ...newConfig };
    localStorage.setItem('hypnoConfig', JSON.stringify(config));
    Toast.show('Hypno settings updated', 'info');
};

export const getConfig = () => config;

// ── Subliminal Words ──
const WORDS = ["OBEY", "CONSUME", "WATCH", "SUBMIT", "SCROLL", "SLEEP", "AWAKE", "NO THOUGHT", "TITKOK", "LOOK", "DEEPER", "RELAX", "FOCUS", "SURRENDER", "FOLLOW", "ABSORB"];

let chaosTimers = [];

// ── Chaos Engine: 46 effects ──
const ChaosEngine = {
    start() {
        if (!overlayContainer) return;
        document.addEventListener('mousemove', this.onMove);
        document.addEventListener('touchmove', this.onMove);

        // Persistent layers
        if (config.scanlines) this.addLayer(overlayContainer, 'hypno-scanlines');
        if (config.tunnel) this.addLayer(overlayContainer, 'hypno-tunnel');
        if (config.filmGrain) this.addLayer(overlayContainer, 'hypno-film-grain');
        if (config.speedLines) this.addLayer(overlayContainer, 'hypno-speed-lines');

        this.scheduleEffect();
    },

    stop() {
        document.removeEventListener('mousemove', this.onMove);
        document.removeEventListener('touchmove', this.onMove);
        chaosTimers.forEach(t => clearTimeout(t));
        chaosTimers = [];

        if (overlayContainer) overlayContainer.innerHTML = '';

        // Remove ALL body effect classes
        const allClasses = [
            'hypno-breathe', 'hypno-glitch', 'hypno-invert', 'hypno-shake',
            'hypno-blur', 'hypno-tilt', 'hypno-tilt-reverse',
            'hypno-mirror-x', 'hypno-mirror-y',
            'hypno-liquid', 'hypno-strobe', 'hypno-double-vision',
            'hypno-stretch', 'hypno-color-cycle', 'hypno-vortex',
            'hypno-rgb-shift', 'hypno-pixelate',
            'hypno-zoom-pulse', 'hypno-skew-x', 'hypno-skew-y',
            'hypno-negative-flash', 'hypno-wobble', 'hypno-fade-pulse',
            'hypno-color-drain', 'hypno-red-channel', 'hypno-blue-channel',
            'hypno-green-channel', 'hypno-sepia-flash', 'hypno-thermal',
            'hypno-night-vision', 'hypno-heartbeat', 'hypno-earthquake',
            'hypno-drunk', 'hypno-solarize', 'hypno-hologram', 'hypno-old-tv',
            'hypno-cyberpunk', 'hypno-blood-moon', 'hypno-retro-wave',
            'hypno-datamosh', 'hypno-ghost-trail', 'hypno-fish-eye',
            'hypno-blackout', 'hypno-whiteout', 'hypno-chroma-storm'
        ];
        document.body.classList.remove(...allClasses);
    },

    addLayer(container, className) {
        if (!container) return null;
        if (!container.querySelector(`.${className}`)) {
            const el = document.createElement('div');
            el.className = className;
            el.style.pointerEvents = 'none';
            container.appendChild(el);
            return el;
        }
        return container.querySelector(`.${className}`);
    },

    onMove(e) {
        if (Math.random() > 0.3) return;
        const pt = e.touches ? e.touches[0] : e;
        const ghost = document.createElement('div');
        ghost.className = 'hypno-cursor-ghost';
        ghost.style.left = pt.clientX + 'px';
        ghost.style.top = pt.clientY + 'px';
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);
        setTimeout(() => ghost.remove(), 500);
    },

    scheduleEffect() {
        if (!hypnoActive) return;
        const delay = 300 + Math.random() * 1500;
        const id = setTimeout(() => {
            this.triggerRandomEffect();
            this.scheduleEffect();
        }, delay);
        chaosTimers.push(id);
    },

    _timedClass(cls, duration) {
        document.body.classList.add(cls);
        setTimeout(() => document.body.classList.remove(cls), duration);
    },

    _timedOverlay(cls, duration) {
        if (!overlayContainer) return;
        const el = this.addLayer(overlayContainer, cls);
        if (el) setTimeout(() => el.remove(), duration);
    },

    triggerRandomEffect() {
        if (!overlayContainer) return;

        // Collect all enabled effects
        const pool = [];

        // ── Visual / Chill ──
        if (config.textSubliminal) pool.push('textSubliminal');
        if (config.rgbShift) pool.push('rgbShift');
        if (config.pixelate) pool.push('pixelate');
        if (config.breathe) pool.push('breathe');
        if (config.tilt) pool.push('tilt');
        if (config.mirror) pool.push('mirror');
        if (config.colorCycle) pool.push('colorCycle');
        if (config.fadePulse) pool.push('fadePulse');
        if (config.sepiaFlash) pool.push('sepiaFlash');

        // ── Motion / Transform ──
        if (config.doubleVision) pool.push('doubleVision');
        if (config.verticalStretch) pool.push('verticalStretch');
        if (config.glitch) pool.push('glitch');
        if (config.zoomPulse) pool.push('zoomPulse');
        if (config.skewHorizontal) pool.push('skewHorizontal');
        if (config.skewVertical) pool.push('skewVertical');
        if (config.wobble) pool.push('wobble');
        if (config.heartbeat) pool.push('heartbeat');
        if (config.earthquake) pool.push('earthquake');
        if (config.drunkMode) pool.push('drunkMode');

        // ── Color / Filter ──
        if (config.negativeFlash) pool.push('negativeFlash');
        if (config.thermalVision) pool.push('thermalVision');
        if (config.nightVision) pool.push('nightVision');
        if (config.redChannel) pool.push('redChannel');
        if (config.blueChannel) pool.push('blueChannel');
        if (config.greenChannel) pool.push('greenChannel');
        if (config.solarize) pool.push('solarize');
        if (config.colorDrain) pool.push('colorDrain');
        if (config.cyberpunk) pool.push('cyberpunk');
        if (config.bloodMoon) pool.push('bloodMoon');
        if (config.retroWave) pool.push('retroWave');

        // ── Overlay / Complex ──
        if (config.strobe) pool.push('strobe');
        if (config.hologram) pool.push('hologram');
        if (config.oldTV) pool.push('oldTV');
        if (config.subliminalFlash) pool.push('subliminalFlash');
        if (config.matrixRain) pool.push('matrixRain');
        if (config.datamosh) pool.push('datamosh');
        if (config.ghostTrail) pool.push('ghostTrail');
        if (config.fishEye) pool.push('fishEye');

        // ── Extreme ──
        if (config.kaleidoscope) pool.push('kaleidoscope');
        if (config.liquidWarp) pool.push('liquidWarp');
        if (config.vortex) pool.push('vortex');
        if (config.blackout) pool.push('blackout');
        if (config.whiteout) pool.push('whiteout');
        if (config.chromaStorm) pool.push('chromaStorm');

        if (pool.length === 0) return;

        const effect = pool[Math.floor(Math.random() * pool.length)];
        this._executeEffect(effect);
    },

    _executeEffect(effect) {
        switch (effect) {
            // ── Visual / Chill ──
            case 'textSubliminal': {
                const word = WORDS[Math.floor(Math.random() * WORDS.length)];
                const el = document.createElement('div');
                el.className = 'hypno-subliminal-text';
                el.innerText = word;
                el.style.pointerEvents = 'none';
                overlayContainer.appendChild(el);
                setTimeout(() => el.remove(), 200);
                break;
            }
            case 'rgbShift':
                this._timedClass('hypno-rgb-shift', 2000 + Math.random() * 2000);
                break;
            case 'pixelate':
                this._timedClass('hypno-pixelate', 800 + Math.random() * 800);
                break;
            case 'breathe':
                document.body.classList.toggle('hypno-breathe', Math.random() > 0.3);
                break;
            case 'tilt': {
                document.body.classList.remove('hypno-tilt', 'hypno-tilt-reverse');
                const cls = Math.random() > 0.5 ? 'hypno-tilt' : 'hypno-tilt-reverse';
                this._timedClass(cls, 2000 + Math.random() * 2000);
                break;
            }
            case 'mirror': {
                const cls = Math.random() > 0.5 ? 'hypno-mirror-x' : 'hypno-mirror-y';
                this._timedClass(cls, 2000 + Math.random() * 2000);
                break;
            }
            case 'colorCycle':
                document.body.classList.toggle('hypno-color-cycle', Math.random() > 0.5);
                break;
            case 'fadePulse':
                this._timedClass('hypno-fade-pulse', 3000);
                break;
            case 'sepiaFlash':
                this._timedClass('hypno-sepia-flash', 600);
                break;

            // ── Motion / Transform ──
            case 'doubleVision':
                document.body.classList.toggle('hypno-double-vision');
                break;
            case 'verticalStretch':
                this._timedClass('hypno-stretch', 1500 + Math.random() * 1500);
                break;
            case 'glitch':
                this._timedClass('hypno-glitch', 200 + Math.random() * 400);
                break;
            case 'zoomPulse':
                this._timedClass('hypno-zoom-pulse', 2000);
                break;
            case 'skewHorizontal':
                this._timedClass('hypno-skew-x', 1500);
                break;
            case 'skewVertical':
                this._timedClass('hypno-skew-y', 1500);
                break;
            case 'wobble':
                this._timedClass('hypno-wobble', 2000);
                break;
            case 'heartbeat':
                this._timedClass('hypno-heartbeat', 2000);
                break;
            case 'earthquake':
                this._timedClass('hypno-earthquake', 1000 + Math.random() * 1000);
                break;
            case 'drunkMode':
                this._timedClass('hypno-drunk', 3000 + Math.random() * 2000);
                break;

            // ── Color / Filter ──
            case 'negativeFlash':
                this._timedClass('hypno-negative-flash', 300);
                break;
            case 'thermalVision':
                this._timedClass('hypno-thermal', 2000 + Math.random() * 2000);
                break;
            case 'nightVision':
                this._timedClass('hypno-night-vision', 3000);
                break;
            case 'redChannel':
                this._timedClass('hypno-red-channel', 2000);
                break;
            case 'blueChannel':
                this._timedClass('hypno-blue-channel', 2000);
                break;
            case 'greenChannel':
                this._timedClass('hypno-green-channel', 2000);
                break;
            case 'solarize':
                this._timedClass('hypno-solarize', 1500);
                break;
            case 'colorDrain':
                this._timedClass('hypno-color-drain', 3000);
                break;
            case 'cyberpunk':
                this._timedClass('hypno-cyberpunk', 2500);
                break;
            case 'bloodMoon':
                this._timedClass('hypno-blood-moon', 3000);
                break;
            case 'retroWave':
                this._timedClass('hypno-retro-wave', 3000);
                break;

            // ── Overlay / Complex ──
            case 'strobe':
                this._timedClass('hypno-strobe', 400);
                break;
            case 'hologram':
                this._timedClass('hypno-hologram', 2500);
                break;
            case 'oldTV':
                this._timedClass('hypno-old-tv', 2000);
                break;
            case 'subliminalFlash':
                this._timedClass('hypno-subliminal-flash', 100);
                break;
            case 'matrixRain':
                this._timedOverlay('hypno-matrix-rain', 4000);
                break;
            case 'datamosh':
                this._timedClass('hypno-datamosh', 800);
                break;
            case 'ghostTrail':
                this._timedClass('hypno-ghost-trail', 3000);
                break;
            case 'fishEye':
                this._timedClass('hypno-fish-eye', 2000);
                break;

            // ── Extreme ──
            case 'kaleidoscope':
                this._timedOverlay('hypno-kaleido-layer', 4000);
                break;
            case 'liquidWarp':
                this._timedClass('hypno-liquid', 3000);
                break;
            case 'vortex':
                this._timedClass('hypno-vortex', 2500);
                break;
            case 'blackout':
                this._timedClass('hypno-blackout', 500 + Math.random() * 1000);
                break;
            case 'whiteout':
                this._timedClass('hypno-whiteout', 300 + Math.random() * 500);
                break;
            case 'chromaStorm':
                this._timedClass('hypno-chroma-storm', 2000);
                break;
        }
    }
};

// ── Utils ──
const stop = () => {
    hypnoActive = false;
    hypnoTimers.forEach(id => clearTimeout(id));
    hypnoTimers = [];
    ChaosEngine.stop();

    if (overlayContainer) {
        overlayContainer.innerHTML = '';
        overlayContainer.remove();
        overlayContainer = null;
    }
    activePopups.clear();
    document.querySelectorAll('.hypno-toggle-btn').forEach(btn => btn.classList.remove('active'));
};

const scheduleSpawn = (delay) => {
    if (!hypnoActive) return;
    const id = setTimeout(spawnPopup, delay);
    hypnoTimers.push(id);
};

// ── SPAWN LOGIC (visual only, no games) ──
function spawnPopup() {
    if (!hypnoActive || !overlayContainer) return;

    const allImages = Gallery.getAll();
    if (!allImages || allImages.length === 0) {
        scheduleSpawn(1000);
        return;
    }

    if (!config.popupsEnabled) {
        scheduleSpawn(1000);
        return;
    }

    if (activePopups.size >= config.popupDensity) {
        const first = activePopups.values().next().value;
        if (first) {
            first.remove();
            activePopups.delete(first);
        }
    }

    const randImg = allImages[Math.floor(Math.random() * allImages.length)];
    const popup = document.createElement('div');
    popup.className = 'hypno-popup hypno-fleet';

    const img = document.createElement('img');
    img.src = Gallery.getImageURL(randImg, 400);
    img.draggable = false;
    img.style.pointerEvents = 'none';
    popup.appendChild(img);

    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    const baseSize = Math.min(100 + Math.random() * 250, maxW - 20);
    const size = baseSize * (config.popupSize || 1.0);
    const x = Math.max(10, Math.min(Math.random() * (maxW - size), maxW - size - 10));
    const y = Math.max(10, Math.min(Math.random() * (maxH - size), maxH - size - 10));

    popup.style.cssText = `
        left: ${x}px; top: ${y}px;
        width: ${size}px; height: ${size}px;
        opacity: 0;
        transform: scale(${0.5 + Math.random()}) rotate(${Math.random() * 60 - 30}deg);
        pointer-events: none !important;
        transition: opacity 0.5s ease;
        z-index: ${100 + Math.floor(Math.random() * 100)};
        filter: grayscale(${Math.random()}) contrast(1.2) opacity(0.7);
    `;
    requestAnimationFrame(() => {
        popup.style.opacity = 0.3 + Math.random() * 0.5;
        setTimeout(() => {
            popup.style.opacity = 0;
            setTimeout(() => {
                if (popup.parentNode) popup.remove();
                activePopups.delete(popup);
            }, 1000);
        }, 800 + Math.random() * 1500);
    });

    overlayContainer.appendChild(popup);
    activePopups.add(popup);
    const speedMult = config.popupSpeed || 1.0;
    scheduleSpawn((100 + Math.random() * 400) / speedMult);
}

const HypnoPopups = {
    attach(container) {
        const btn = document.createElement('button');
        btn.className = 'hypno-toggle-btn';
        btn.innerHTML = '🌀';
        btn.onclick = (e) => {
            e.stopPropagation();
            if (hypnoActive) {
                this.detach();
                Toast.show('Awake.');
            } else {
                this.start();
                btn.classList.add('active');
                Toast.show('🌀 SUBLIMINAL MODE START', 'info');
            }
        };
        container.appendChild(btn);
    },

    start() {
        if (hypnoActive) return;
        hypnoActive = true;

        overlayContainer = document.getElementById('hypno-overlay');
        if (!overlayContainer) {
            overlayContainer = document.createElement('div');
            overlayContainer.id = 'hypno-overlay';
            document.body.appendChild(overlayContainer);
        }
        overlayContainer.innerHTML = '';

        scheduleSpawn(200);
        ChaosEngine.start();
    },

    detach() {
        stop();
    }
};

export default HypnoPopups;
