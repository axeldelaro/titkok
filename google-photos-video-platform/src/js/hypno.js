/* ── Hypnotic Popup: SUBLIMINAL MODE ──
 * 95% Ghostly fleeting images (visual only)
 * 5% Mini-games (interactive)
 * + 10 Chaos Effects (Text, Glitch, Spiral, etc.)
 */
import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let hypnoActive = false;
let hypnoTimers = [];
let activePopups = new Set();
let overlayContainer = null;
const MAX_POPUPS = 25;

// Load config from localStorage or default
const DEFAULT_CONFIG = {
    scanlines: true,
    rgbShift: true,
    kaleidoscope: false, // Intensive
    pixelate: true,
    liquidWarp: false, // Intensive
    strobe: true,
    doubleVision: true,
    tunnel: true,
    verticalStretch: true,
    colorCycle: false, // Can be annoying
    vortex: false, // Motion sickness warning
    textSubliminal: true,
    glitch: true,
    breathe: true,
    tilt: true,
    mirror: true
};

let config = JSON.parse(localStorage.getItem('hypnoConfig') || JSON.stringify(DEFAULT_CONFIG));

export const updateConfig = (newConfig) => {
    config = { ...config, ...newConfig };
    localStorage.setItem('hypnoConfig', JSON.stringify(config));
    Toast.show('Hypno settings updated', 'info');
};

export const getConfig = () => config;

// ── Chaos Engine ──
const WORDS = ["OBEY", "CONSUME", "WATCH", "SUBMIT", "SCROLL", "SLEEP", "AWAKE", "NO THOUGHT", "TITKOK", "LOOK"];
let chaosTimers = [];

const ChaosEngine = {
    start() {
        if (!overlayContainer) return;

        // 1. Cursor Ghost
        document.addEventListener('mousemove', this.onMove);
        document.addEventListener('touchmove', this.onMove);

        // 2. Persistent layers based on config
        if (config.scanlines) this.addLayer(overlayContainer, 'hypno-scanlines');
        if (config.tunnel) this.addLayer(overlayContainer, 'hypno-tunnel');

        // Start random loops
        this.scheduleEffect();
    },

    stop() {
        document.removeEventListener('mousemove', this.onMove);
        document.removeEventListener('touchmove', this.onMove);
        chaosTimers.forEach(t => clearTimeout(t));
        chaosTimers = [];

        if (overlayContainer) {
            overlayContainer.innerHTML = ''; // Clear all layers
        }

        // Clean up body classes
        document.body.classList.remove(
            'hypno-breathe', 'hypno-glitch', 'hypno-invert', 'hypno-shake',
            'hypno-blur', 'hypno-tilt', 'hypno-tilt-reverse',
            'hypno-mirror-x', 'hypno-mirror-y',
            'hypno-liquid', 'hypno-strobe', 'hypno-double-vision',
            'hypno-stretch', 'hypno-color-cycle', 'hypno-vortex',
            'hypno-rgb-shift', 'hypno-pixelate'
        );
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
        if (Math.random() > 0.3) return; // Throttling
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
        const delay = 500 + Math.random() * 2000;
        const id = setTimeout(() => {
            this.triggerRandomEffect();
            this.scheduleEffect();
        }, delay);
        chaosTimers.push(id);
    },

    triggerRandomEffect() {
        if (!overlayContainer) return;
        const roll = Math.random();

        // 3. Subliminal Text
        if (config.textSubliminal && roll < 0.2) {
            const word = WORDS[Math.floor(Math.random() * WORDS.length)];
            const el = document.createElement('div');
            el.className = 'hypno-subliminal-text';
            el.innerText = word;
            el.style.pointerEvents = 'none';
            overlayContainer.appendChild(el);
            setTimeout(() => el.remove(), 200);
        }

        // 4. Glitch
        else if (config.glitch && roll < 0.3) {
            document.body.classList.add('hypno-glitch');
            setTimeout(() => document.body.classList.remove('hypno-glitch'), 200 + Math.random() * 400);
        }

        // 5. RGB Shift (Toggle)
        else if (config.rgbShift && roll < 0.4) {
            document.body.classList.toggle('hypno-rgb-shift');
            if (document.body.classList.contains('hypno-rgb-shift')) {
                setTimeout(() => document.body.classList.remove('hypno-rgb-shift'), 3000);
            }
        }

        // 6. Strobe (Quick flash)
        else if (config.strobe && roll < 0.45) {
            document.body.classList.add('hypno-strobe');
            setTimeout(() => document.body.classList.remove('hypno-strobe'), 500);
        }

        // 7. Liquid Warp
        else if (config.liquidWarp && roll < 0.5) {
            document.body.classList.add('hypno-liquid');
            setTimeout(() => document.body.classList.remove('hypno-liquid'), 4000);
        }

        // 8. Double Vision
        else if (config.doubleVision && roll < 0.6) {
            document.body.classList.toggle('hypno-double-vision');
        }

        // 9. Pixelate
        else if (config.pixelate && roll < 0.65) {
            document.body.classList.add('hypno-pixelate');
            setTimeout(() => document.body.classList.remove('hypno-pixelate'), 1000);
        }

        // 10. Vertical Stretch
        else if (config.verticalStretch && roll < 0.75) {
            document.body.classList.add('hypno-stretch');
            setTimeout(() => document.body.classList.remove('hypno-stretch'), 2000);
        }

        // 11. Vortex (Rare)
        else if (config.vortex && roll < 0.8) {
            document.body.classList.add('hypno-vortex');
            setTimeout(() => document.body.classList.remove('hypno-vortex'), 3000);
        }

        // 12. Mirror Mode
        else if (config.mirror && roll < 0.85) {
            if (Math.random() > 0.5) {
                const cls = Math.random() > 0.5 ? 'hypno-mirror-x' : 'hypno-mirror-y';
                document.body.classList.add(cls);
                setTimeout(() => document.body.classList.remove(cls), 3000);
            }
        }

        // 13. Breathe & Tilt (Persistent)
        else {
            if (config.breathe) document.body.classList.toggle('hypno-breathe', Math.random() > 0.3);
            if (config.colorCycle) document.body.classList.toggle('hypno-color-cycle', Math.random() > 0.8);

            if (config.tilt) {
                const tilt = Math.random();
                document.body.classList.remove('hypno-tilt', 'hypno-tilt-reverse');
                if (tilt > 0.7) document.body.classList.add('hypno-tilt');
                else if (tilt > 0.85) document.body.classList.add('hypno-tilt-reverse');
            }
        }
    }
};

// ── Utils ──
const stop = () => {
    hypnoActive = false;
    hypnoTimers.forEach(id => clearTimeout(id));
    hypnoTimers = [];

    // Stop Chaos
    ChaosEngine.stop();

    if (overlayContainer) {
        overlayContainer.innerHTML = '';
        overlayContainer.remove();
        overlayContainer = null;
    }
    activePopups.clear();

    // Remove active state from any toggle buttons
    document.querySelectorAll('.hypno-toggle-btn').forEach(btn => btn.classList.remove('active'));
};

const dismissPopup = (popup, isGame = true) => {
    if (popup._cleanup) popup._cleanup();
    activePopups.delete(popup);

    if (isGame) {
        popup.classList.add('hypno-solved');
        setTimeout(() => popup.remove(), 600);
    } else {
        popup.remove();
    }
};

const scheduleSpawn = (delay) => {
    if (!hypnoActive) return;
    const id = setTimeout(spawnPopup, delay);
    hypnoTimers.push(id);
};

// ── MINI-GAMES ──
const runGame = (popup, img, type) => {
    // 1. TAP (20-40)
    if (type === 0) {
        const needed = 20 + Math.floor(Math.random() * 21);
        let taps = 0;
        const counter = document.createElement('div');
        counter.className = 'hypno-counter';
        counter.innerText = `👆 0/${needed}`;
        popup.appendChild(counter);
        const bar = document.createElement('div');
        bar.className = 'hypno-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'hypno-progress-fill';
        bar.appendChild(fill);
        popup.appendChild(bar);

        const onTap = (e) => {
            e.preventDefault(); e.stopPropagation();
            taps++;
            fill.style.width = Math.min(100, (taps / needed) * 100) + '%';
            counter.innerText = `👆 ${taps}/${needed}`;
            popup.style.transform = `scale(${1 + Math.random() * 0.1})`;
            if (taps >= needed) dismissPopup(popup);
        };
        popup.addEventListener('click', onTap);
        popup.addEventListener('touchend', onTap);
    }
    // 2. HOLD (4s)
    else if (type === 1) {
        img.style.filter = 'blur(20px) brightness(0.4)';
        const label = document.createElement('div');
        label.className = 'hypno-counter';
        label.innerText = '✋ Hold 4s';
        popup.appendChild(label);
        const bar = document.createElement('div');
        bar.className = 'hypno-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'hypno-progress-fill hold-fill';
        bar.appendChild(fill);
        popup.appendChild(bar);

        let progress = 0, holdInterval;
        const start = (e) => {
            e.preventDefault(); e.stopPropagation();
            holdInterval = setInterval(() => {
                progress += 1.5;
                fill.style.width = Math.min(100, progress) + '%';
                img.style.filter = `blur(${Math.max(0, 20 - progress * 0.2)}px)`;
                if (progress >= 100) { clearInterval(holdInterval); dismissPopup(popup); }
            }, 60);
        };
        const end = () => {
            clearInterval(holdInterval);
            if (progress < 100 && progress > 0) {
                progress = Math.max(0, progress - 30);
                fill.style.width = progress + '%';
                img.style.filter = `blur(${Math.max(0, 20 - progress * 0.2)}px) brightness(0.4)`;
            }
        };
        popup.addEventListener('mousedown', start);
        popup.addEventListener('touchstart', start, { passive: false });
        popup.addEventListener('mouseup', end);
        popup.addEventListener('touchend', end);
        popup._cleanup = () => clearInterval(holdInterval);
    }
    // 3. CATCH (6x)
    else if (type === 2) {
        let catches = 0;
        const needed = 6;
        const label = document.createElement('div');
        label.className = 'hypno-counter';
        label.innerText = `🎯 0/${needed}`;
        popup.appendChild(label);

        let canDodge = true;
        let lastDodge = 0;

        const dodge = () => {
            const now = Date.now();
            if (!canDodge || now - lastDodge < 400) return;
            lastDodge = now;

            const maxX = window.innerWidth - popup.offsetWidth;
            const maxY = window.innerHeight - popup.offsetHeight;

            if (Math.random() > 0.3) {
                popup.style.left = Math.max(0, Math.min(maxX, Math.random() * maxX)) + 'px';
                popup.style.top = Math.max(0, Math.min(maxY, Math.random() * maxY)) + 'px';
            }
        };

        const onTouchStart = (e) => {
            if (canDodge) {
                dodge();
            }
        };

        const onAttempt = (e) => {
            e.preventDefault(); e.stopPropagation();

            if (Math.random() > 0.3) {
                dodge();
                return;
            }

            catches++;
            label.innerText = `🎯 ${catches}/${needed}`;
            canDodge = false;
            popup.style.transform = 'scale(0.95)';
            popup.style.filter = 'brightness(1.5)';

            setTimeout(() => {
                if (catches >= needed) dismissPopup(popup);
                else {
                    canDodge = true;
                    popup.style.transform = '';
                    popup.style.filter = '';
                    dodge();
                }
            }, 200);
        };

        popup.addEventListener('mousedown', onAttempt);
        popup.addEventListener('touchstart', onTouchStart, { passive: false });
        popup.addEventListener('click', onAttempt);
    }
    // 4. SWIPE (300px)
    else {
        const label = document.createElement('div');
        label.className = 'hypno-counter';
        label.innerText = '👉 Drag Away';
        popup.appendChild(label);
        let startX, startY, dragging = false;

        const down = (e) => {
            dragging = true;
            const pt = e.touches ? e.touches[0] : e;
            startX = pt.clientX; startY = pt.clientY;
            popup.style.zIndex = 10000;
            popup.style.transition = 'none';
        };

        const move = (e) => {
            if (!dragging) return;
            e.preventDefault();
            const pt = e.touches ? e.touches[0] : e;
            const dx = pt.clientX - startX;
            const dy = pt.clientY - startY;
            popup.style.transform = `translate(${dx}px, ${dy}px)`;

            if (Math.hypot(dx, dy) > 250) {
                popup.style.opacity = 0.5;
                label.innerText = 'Release!';
            }
        };

        const up = (e) => {
            if (!dragging) return;
            dragging = false;
            const pt = e.changedTouches ? e.changedTouches[0] : e;
            const dx = pt.clientX - startX;
            const dy = pt.clientY - startY;

            if (Math.hypot(dx, dy) > 250) {
                dismissPopup(popup);
            } else {
                popup.style.transition = 'transform 0.3s ease';
                popup.style.transform = 'translate(0, 0)';
                popup.style.opacity = 1;
                label.innerText = '👉 Drag Away';
            }
            popup.style.zIndex = '';
        };

        popup.addEventListener('mousedown', down);
        popup.addEventListener('touchstart', down, { passive: false });
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', up);
        document.addEventListener('touchend', up);

        popup._cleanup = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('mouseup', up);
            document.removeEventListener('touchend', up);
        };
    }
};

// ── SPAWN LOGIC ──
function spawnPopup() {
    if (!hypnoActive || !overlayContainer) return;

    const allImages = Gallery.getAll();
    if (!allImages || allImages.length === 0) {
        scheduleSpawn(1000);
        return;
    }

    if (activePopups.size >= MAX_POPUPS) {
        const it = activePopups.values();
        const first = it.next().value;
        if (first && !first.classList.contains('hypno-game')) {
            first.remove();
            activePopups.delete(first);
        }
    }

    const randImg = allImages[Math.floor(Math.random() * allImages.length)];
    const popup = document.createElement('div');
    popup.className = 'hypno-popup';

    const img = document.createElement('img');
    img.src = Gallery.getImageURL(randImg, 400);
    img.draggable = false;
    img.style.pointerEvents = 'none';
    popup.appendChild(img);

    const isGame = Math.random() < 0.05; // 5% chance of game

    const size = isGame ? (150 + Math.random() * 100) : (100 + Math.random() * 250);
    const x = Math.random() * (window.innerWidth - size);
    const y = Math.random() * (window.innerHeight - size);

    if (!isGame) {
        // FLEET
        popup.classList.add('hypno-fleet');
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
    } else {
        // GAME
        popup.classList.add('hypno-game');
        popup.style.cssText = `
            left: ${x}px; top: ${y}px;
            width: ${size}px; height: ${size}px;
            animation: hypnoAppearSoft 0.4s ease-out forwards;
            z-index: 10001; 
            pointer-events: auto !important; 
            cursor: pointer; /* Enable pointer */
            touch-action: none;
        `;
        runGame(popup, img, Math.floor(Math.random() * 4));
    }

    overlayContainer.appendChild(popup);
    activePopups.add(popup);

    scheduleSpawn(100 + Math.random() * 400);
}

const HypnoPopups = {
    attach(container) {
        // Create Toggle Button in the feed container
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

        // Create Full Screen Overlay
        overlayContainer = document.getElementById('hypno-overlay');
        if (!overlayContainer) {
            overlayContainer = document.createElement('div');
            overlayContainer.id = 'hypno-overlay';
            document.body.appendChild(overlayContainer);
        }
        overlayContainer.innerHTML = ''; // Start clean

        scheduleSpawn(200);
        ChaosEngine.start();
    },

    detach() {
        stop();
    }
};

export default HypnoPopups;
