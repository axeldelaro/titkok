/* ── Hypnotic Popup Mini-Games (Intrusive Mode) ──
 * Spawns multiple concurrent popups with harder interactive mini-games.
 * Call HypnoPopups.attach(container) to start the chaos.
 */
import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let hypnoActive = false;
let hypnoTimers = [];
let activePopups = new Set();
let activeContainer = null;
const MAX_POPUPS = 12; // Allow up to 12 simultaneous popups!

const stop = () => {
    hypnoActive = false;
    hypnoTimers.forEach(id => clearTimeout(id));
    hypnoTimers = [];
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

const dismissPopup = (popup) => {
    if (popup._cleanup) popup._cleanup(); // Remove listeners immediately
    popup.classList.add('hypno-solved');
    activePopups.delete(popup);

    // Schedule separation of popups to keep flow
    setTimeout(() => {
        popup.remove();
        // Immediately spawn another to replace it if active
        if (hypnoActive) {
            scheduleSpawn(200 + Math.random() * 800);
        }
    }, 600);
};

const scheduleSpawn = (delay) => {
    if (!hypnoActive) return;
    const id = setTimeout(spawnPopup, delay);
    hypnoTimers.push(id);
};

// ── MINI-GAMES (HARDER & CHAOTIC) ──

// 1. TAP CHALLENGE — tap 30-50 times
const gameTap = (popup) => {
    const needed = 30 + Math.floor(Math.random() * 21); // 30–50
    let taps = 0;
    const counter = document.createElement('div');
    counter.className = 'hypno-counter';
    counter.textContent = `👆 0/${needed}`;
    popup.appendChild(counter);

    const bar = document.createElement('div');
    bar.className = 'hypno-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'hypno-progress-fill';
    bar.appendChild(fill);
    popup.appendChild(bar);

    const onTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        taps++;
        const pct = Math.min(100, (taps / needed) * 100);
        fill.style.width = pct + '%';
        counter.textContent = `👆 ${taps}/${needed}`;

        // Chaotic movement on tap
        popup.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px) scale(${1 + Math.random() * 0.1})`;

        if (taps >= needed) dismissPopup(popup);
    };
    popup.addEventListener('click', onTap);
    popup.addEventListener('touchend', onTap);
};

// 2. HOLD & REVEAL — hold for 4s, reset if released
const gameHold = (popup, img) => {
    img.style.filter = 'blur(25px) brightness(0.3)';
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = '✋ Hold 4s';
    popup.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'hypno-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'hypno-progress-fill hold-fill';
    bar.appendChild(fill);
    popup.appendChild(bar);

    let progress = 0;
    let holdInterval = null;

    const startHold = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop scrolling
        holdInterval = setInterval(() => {
            progress += 1.5; // Slower progress
            const pct = Math.min(100, progress);
            fill.style.width = pct + '%';
            img.style.filter = `blur(${Math.max(0, 25 - progress * 0.25)}px) brightness(${0.3 + progress * 0.007})`;
            label.textContent = `${Math.floor(pct)}%`;
            if (progress >= 100) {
                clearInterval(holdInterval);
                img.style.filter = 'none';
                dismissPopup(popup);
            }
        }, 60);
    };
    const endHold = () => {
        clearInterval(holdInterval);
        if (progress < 100 && progress > 0) {
            // Punishing reset
            progress = Math.max(0, progress - 20);
            const pct = Math.min(100, progress);
            fill.style.width = pct + '%';
            img.style.filter = `blur(${Math.max(0, 25 - progress * 0.25)}px) brightness(${0.3 + progress * 0.007})`;
            label.textContent = '✋ Don\'t let go!';
        }
    };

    popup.addEventListener('mousedown', startHold);
    popup.addEventListener('touchstart', startHold, { passive: false });
    popup.addEventListener('mouseup', endHold);
    popup.addEventListener('mouseleave', endHold);
    popup.addEventListener('touchend', endHold);

    popup._cleanup = () => clearInterval(holdInterval);
};

// 3. CATCH ME — faster, 8 catches
const gameCatch = (popup) => {
    let catches = 0;
    const needed = 8;
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = `🎯 0/${needed}`;
    popup.appendChild(label);

    let canDodge = true;

    const dodge = () => {
        if (!canDodge) return;
        // Move anywhere on screen
        const maxX = window.innerWidth - popup.offsetWidth;
        const maxY = window.innerHeight - popup.offsetHeight;
        popup.style.transition = 'left 0.2s cubic-bezier(0.1, 0.7, 1.0, 0.1), top 0.2s cubic-bezier(0.1, 0.7, 1.0, 0.1)';
        popup.style.left = (Math.random() * maxX) + 'px';
        popup.style.top = (Math.random() * maxY) + 'px';
    };

    const onDodge = (e) => {
        if (canDodge) {
            e.preventDefault();
            dodge();
        }
    };
    popup.addEventListener('touchstart', onDodge, { passive: false });
    popup.addEventListener('mouseenter', () => { if (canDodge) dodge(); });

    const onCatch = (e) => {
        e.preventDefault();
        e.stopPropagation();
        catches++;
        label.textContent = `🎯 ${catches}/${needed}`;
        // Brief freeze
        canDodge = false;
        popup.style.transform = 'scale(0.95)';
        popup.style.borderColor = '#fff';
        setTimeout(() => {
            if (catches >= needed) {
                dismissPopup(popup);
            } else {
                canDodge = true;
                popup.style.transform = '';
                popup.style.borderColor = '';
                dodge(); // Immediate dodge after catch
            }
        }, 400);
    };
    popup.addEventListener('mousedown', onCatch); // click matches mouseup, mousedown is faster
    popup.addEventListener('touchend', onCatch); // Fallback if dodge doesn't trigger
};

// 4. CORNER CHAOS — Tap 4 corners but they rotate/shift
const gamePattern = (popup) => {
    const zones = ['↖', '↗', '↘', '↙'];
    let step = 0;

    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = `Tap ${zones[0]}`;
    popup.appendChild(label);

    const positions = [
        { top: '0', left: '0' },
        { top: '0', right: '0' },
        { bottom: '0', right: '0' },
        { bottom: '0', left: '0' }
    ];

    // Randomize zone order
    const sequence = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    positions.forEach((pos, i) => {
        const zone = document.createElement('div');
        zone.className = 'hypno-tap-zone';
        zone.dataset.idx = i;
        Object.assign(zone.style, pos, {
            position: 'absolute', width: '40%', height: '40%', zIndex: '5', cursor: 'pointer'
        });

        // Highlight first target
        if (i === sequence[0]) zone.classList.add('hypno-zone-active');

        popup.appendChild(zone);

        const onTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (i === sequence[step]) {
                zone.classList.remove('hypno-zone-active');
                step++;
                if (step >= 4) {
                    dismissPopup(popup);
                } else {
                    label.textContent = `Tap ${zones[sequence[step]]}`;
                    // Find DOM element for next step (a bit hacking since we didn't save refs, but ok)
                    const nextZone = popup.querySelector(`.hypno-tap-zone[data-idx="${sequence[step]}"]`);
                    if (nextZone) nextZone.classList.add('hypno-zone-active');
                }
            } else {
                // Reset on fail
                step = 0;
                popup.querySelectorAll('.hypno-tap-zone').forEach(z => z.classList.remove('hypno-zone-active'));
                const firstZone = popup.querySelector(`.hypno-tap-zone[data-idx="${sequence[0]}"]`);
                if (firstZone) firstZone.classList.add('hypno-zone-active');
                label.textContent = `❌ FAIL! Tap ${zones[sequence[0]]}`;
                popup.style.animation = 'none';
                popup.offsetHeight;
                popup.style.animation = 'hypnoShake 0.4s ease';
            }
        };
        zone.addEventListener('click', onTap);
        zone.addEventListener('touchend', onTap);
    });
};

// 5. DRAG & DROP — Drag to a specific target appearing on screen
// Simplified to "Long Swipe" for now but longer distance
const gameSwipe = (popup) => {
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = '👉 Drag 300px';
    popup.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'hypno-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'hypno-progress-fill swipe-fill';
    bar.appendChild(fill);
    popup.appendChild(bar);

    let startX = 0, startY = 0, origLeft = 0, origTop = 0;
    let dragging = false;
    const THRESHOLD = 300; // Harder swipe

    const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        const pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        origLeft = popup.offsetLeft;
        origTop = popup.offsetTop;
        popup.style.transition = 'none';
        popup.style.zIndex = 10000; // Bring to front
    };
    const move = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        popup.style.left = (origLeft + dx) + 'px';
        popup.style.top = (origTop + dy) + 'px';
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pct = Math.min(100, (dist / THRESHOLD) * 100);
        fill.style.width = pct + '%';
        label.textContent = dist > THRESHOLD ? '🚀 Release!' : `${Math.round(dist)}px`;
    };
    const up = (e) => {
        if (!dragging) return;
        dragging = false;
        popup.style.zIndex = '';
        const pt = e.changedTouches ? e.changedTouches[0] : e;
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > THRESHOLD) {
            dismissPopup(popup);
        } else {
            // Snap back
            popup.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            popup.style.left = origLeft + 'px';
            popup.style.top = origTop + 'px';
            fill.style.width = '0%';
            label.textContent = '👉 Try harder!';
        }
    };

    popup.addEventListener('mousedown', down);
    popup.addEventListener('touchstart', down, { passive: false });
    const mv = (e) => move(e);
    const end = (e) => up(e);
    // Bind to document to catch drags outside popup
    document.addEventListener('mousemove', mv);
    document.addEventListener('touchmove', mv, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);

    // Attach cleanup function to popup
    popup._cleanup = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('touchmove', mv);
        document.removeEventListener('mouseup', end);
        document.removeEventListener('touchend', end);
    };
};

const miniGames = [gameTap, gameHold, gameCatch, gamePattern, gameSwipe];

function spawnPopup() {
    if (!hypnoActive || !activeContainer) return;
    if (activePopups.size >= MAX_POPUPS) return; // Cap at 12

    const allImages = Gallery.getAll();
    if (allImages.length === 0) return;

    const randImg = allImages[Math.floor(Math.random() * allImages.length)];
    const popup = document.createElement('div');
    popup.className = 'hypno-popup';

    const img = document.createElement('img');
    img.src = Gallery.getImageURL(randImg, 400);
    img.draggable = false;
    popup.appendChild(img);

    // Random Chaos Size
    const size = 140 + Math.random() * 100;
    // Random position allowing slight overflow
    const x = Math.random() * (window.innerWidth - size);
    const y = Math.random() * (window.innerHeight - size);

    popup.style.cssText = `
        left: ${x}px; top: ${y}px;
        width: ${size}px; height: ${size}px;
        animation: hypnoAppearSoft 0.4s ease-out forwards;
        transform: rotate(${Math.random() * 20 - 10}deg);
    `;

    activeContainer.appendChild(popup);
    activePopups.add(popup);

    const game = miniGames[Math.floor(Math.random() * miniGames.length)];
    game(popup, img);

    // Schedule next spawn aggressively
    scheduleSpawn(500 + Math.random() * 1000); // 0.5s - 1.5s delay
}

const HypnoPopups = {
    attach(container) {
        this.detach();
        activeContainer = container;

        const btn = document.createElement('button');
        btn.className = 'hypno-toggle-btn';
        btn.innerHTML = '🌀';
        btn.title = 'Hypnotic Mode';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (hypnoActive) {
                stop();
                Toast.show('Hypnotic mode off... for now.');
            } else {
                hypnoActive = true;
                btn.classList.add('active');
                Toast.show('🌀 CHAOS MODE ACTIVATED!', 'info');
                // Spawn cluster start
                scheduleSpawn(500);
                setTimeout(() => scheduleSpawn(800), 100);
                setTimeout(() => scheduleSpawn(1200), 200);
            }
        });

        container.appendChild(btn);
    },

    detach() {
        stop();
        activeContainer = null;
    }
};

export default HypnoPopups;
