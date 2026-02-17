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
let activeContainer = null;
const MAX_POPUPS = 25;

// ── Chaos Engine ──
const WORDS = ["OBEY", "CONSUME", "WATCH", "SUBMIT", "SCROLL", "SLEEP", "AWAKE", "NO THOUGHT", "TITKOK", "LOOK"];
let chaosTimers = [];

const ChaosEngine = {
    start(container) {
        // 1. Cursor Ghost
        document.addEventListener('mousemove', this.onMove);
        document.addEventListener('touchmove', this.onMove);

        // Ensure container allows clicks through to underlying elements where empty
        // But children (popups) will have their own pointer-events

        // 2. Spiral & Vignette & Static (Append layers)
        this.addLayer(container, 'hypno-spiral');
        this.addLayer(container, 'hypno-vignette');
        this.addLayer(container, 'hypno-static');

        // Start random loops
        this.scheduleEffect();
    },

    stop(container) {
        document.removeEventListener('mousemove', this.onMove);
        document.removeEventListener('touchmove', this.onMove);
        chaosTimers.forEach(t => clearTimeout(t));
        chaosTimers = [];

        // Fix: Check if container exists before querying
        if (container) {
            const layers = container.querySelectorAll('.hypno-spiral, .hypno-vignette, .hypno-static, .hypno-subliminal-text');
            layers.forEach(el => el.remove());
        }
        document.body.classList.remove('hypno-breathe', 'hypno-glitch', 'hypno-hue-shift', 'hypno-mirror-x', 'hypno-mirror-y');
    },

    addLayer(container, className) {
        if (!container) return null; // Safety check
        if (!container.querySelector(`.${className}`)) {
            const el = document.createElement('div');
            el.className = className;
            // CRITICAL: Ensure overlays never block clicks
            el.style.pointerEvents = 'none';
            container.appendChild(el);
            // Randomly activate
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
        ghost.style.pointerEvents = 'none'; // CRITICAL
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
        if (!activeContainer) return;
        const roll = Math.random();

        // 3. Subliminal Text (20% chance)
        if (roll < 0.2) {
            const word = WORDS[Math.floor(Math.random() * WORDS.length)];
            const el = document.createElement('div');
            el.className = 'hypno-subliminal-text';
            el.innerText = word;
            el.style.pointerEvents = 'none'; // CRITICAL
            activeContainer.appendChild(el);
            setTimeout(() => el.remove(), 200);
        }

        // 4. Flash Bang (5% chance)
        else if (roll < 0.25) {
            const el = document.createElement('div');
            el.className = 'hypno-flash-white';
            el.style.pointerEvents = 'none'; // CRITICAL
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 100);
        }

        // 5. Glitch (10% chance)
        else if (roll < 0.35) {
            document.body.classList.add('hypno-glitch');
            setTimeout(() => document.body.classList.remove('hypno-glitch'), 200 + Math.random() * 400);
        }

        // 6. Mirror Mode (10% chance)
        else if (roll < 0.45) {
            const cls = Math.random() > 0.5 ? 'hypno-mirror-x' : 'hypno-mirror-y';
            document.body.classList.add(cls);
            setTimeout(() => document.body.classList.remove(cls), 3000);
        }

        // 7. Toggle Layers (Spiral/Vignette/Static)
        else if (roll < 0.7) {
            const spiral = activeContainer.querySelector('.hypno-spiral');
            if (spiral) spiral.classList.toggle('active', Math.random() > 0.3);

            const vignette = activeContainer.querySelector('.hypno-vignette');
            if (vignette) vignette.classList.toggle('active', Math.random() > 0.4);

            const stat = activeContainer.querySelector('.hypno-static');
            if (stat) stat.classList.toggle('active', Math.random() > 0.6);
        }

        // 8. Breathe & Hue (Persistent toggles)
        else {
            document.body.classList.toggle('hypno-breathe', Math.random() > 0.3);
            document.body.classList.toggle('hypno-hue-shift', Math.random() > 0.7);
        }
    }
};

// ── Utils ──
const stop = () => {
    hypnoActive = false;
    hypnoTimers.forEach(id => clearTimeout(id));
    hypnoTimers = [];

    // Stop Chaos
    ChaosEngine.stop(activeContainer);

    if (activeContainer) {
        activeContainer.querySelectorAll('.hypno-popup').forEach(el => {
            if (el._cleanup) el._cleanup();
            el.remove();
        });
    }
    activePopups.clear();
    const btn = activeContainer?.querySelector('.hypno-toggle-btn');
    if (btn) btn.classList.remove('active');
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

        // Improve movement logic
        const dodge = () => {
            if (!canDodge) return;
            // Ensure it stays within bounds
            const maxX = window.innerWidth - popup.offsetWidth;
            const maxY = window.innerHeight - popup.offsetHeight;
            popup.style.left = Math.max(0, Math.min(maxX, Math.random() * maxX)) + 'px';
            popup.style.top = Math.max(0, Math.min(maxY, Math.random() * maxY)) + 'px';
        };

        const onTouchStart = (e) => {
            // Mobile dodge on touch
            if (canDodge) {
                e.preventDefault();
                dodge();
            }
        };

        const onAttempt = (e) => {
            e.preventDefault(); e.stopPropagation();
            catches++;
            label.innerText = `🎯 ${catches}/${needed}`;
            canDodge = false;
            popup.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (catches >= needed) dismissPopup(popup);
                else { canDodge = true; popup.style.transform = ''; dodge(); }
            }, 300);
        };

        popup.addEventListener('touchstart', onTouchStart, { passive: false });
        popup.addEventListener('mouseenter', () => { if (canDodge) dodge(); });
        popup.addEventListener('mousedown', onAttempt);
        // Add touchend as backup for catching if touchstart didn't dodge
        popup.addEventListener('touchend', (e) => {
            if (!canDodge) onAttempt(e);
        });
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
            popup.style.transition = 'none'; // Clear transition for direct control
        };

        const move = (e) => {
            if (!dragging) return;
            e.preventDefault(); // Prevent scroll
            const pt = e.touches ? e.touches[0] : e;
            const dx = pt.clientX - startX;
            const dy = pt.clientY - startY;
            popup.style.transform = `translate(${dx}px, ${dy}px)`;

            // Visual feedback
            if (Math.hypot(dx, dy) > 250) {
                popup.style.opacity = 0.5;
                label.innerText = 'Release!';
            }
        };

        const up = (e) => {
            if (!dragging) return; // Fix: only run if we were dragging
            dragging = false;
            const pt = e.changedTouches ? e.changedTouches[0] : e;
            const dx = pt.clientX - startX;
            const dy = pt.clientY - startY;

            if (Math.hypot(dx, dy) > 250) {
                dismissPopup(popup);
            } else {
                // Snap back
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
    if (!hypnoActive || !activeContainer) return;

    const allImages = Gallery.getAll();
    if (!allImages || allImages.length === 0) return;

    // Prune if too many
    if (activePopups.size >= MAX_POPUPS) {
        const it = activePopups.values();
        const first = it.next().value;
        if (first && !first.classList.contains('hypno-game')) {
            first.remove();
            activePopups.delete(first);
        } else {
            return;
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
            cursor: pointer;
            touch-action: none; /* CRITICAL: Prevent scrolling on game */
        `;
        runGame(popup, img, Math.floor(Math.random() * 4));
    }

    activeContainer.appendChild(popup);
    activePopups.add(popup);

    scheduleSpawn(100 + Math.random() * 400);
}

const HypnoPopups = {
    attach(container) {
        this.detach();
        activeContainer = container;
        const btn = document.createElement('button');
        btn.className = 'hypno-toggle-btn';
        btn.innerHTML = '🌀';
        btn.onclick = (e) => {
            e.stopPropagation();
            if (hypnoActive) {
                stop();
                Toast.show('Awake.');
            } else {
                hypnoActive = true;
                btn.classList.add('active');
                Toast.show('🌀 SUBLIMINAL MODE START', 'info');
                scheduleSpawn(200);
                ChaosEngine.start(container); // Start the effects
            }
        };
        container.appendChild(btn);
    },
    detach() {
        stop();
        activeContainer = null;
    }
};

export default HypnoPopups;
