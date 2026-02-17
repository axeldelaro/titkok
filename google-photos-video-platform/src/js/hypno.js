/* ── Hypnotic Popup Mini-Games ──
 * Spawns random image popups with interactive mini-games.
 * Call HypnoPopups.attach(container) on any page that needs it.
 * Call HypnoPopups.detach() when leaving the page.
 */
import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let hypnoActive = false;
let hypnoTimers = [];
let currentPopup = null;
let activeContainer = null;
let cleanupFns = [];

const stop = () => {
    hypnoActive = false;
    hypnoTimers.forEach(id => clearTimeout(id));
    hypnoTimers = [];
    if (activeContainer) {
        activeContainer.querySelectorAll('.hypno-popup').forEach(el => el.remove());
    }
    cleanupFns.forEach(fn => fn());
    cleanupFns = [];
    currentPopup = null;
    const btn = activeContainer?.querySelector('.hypno-toggle-btn');
    if (btn) btn.classList.remove('active');
};

const dismissPopup = (popup) => {
    popup.classList.add('hypno-solved');
    setTimeout(() => {
        popup.remove();
        currentPopup = null;
        if (hypnoActive) {
            const nextId = setTimeout(spawnPopup, 3000 + Math.random() * 4000); // 3-7s
            hypnoTimers.push(nextId);
        }
    }, 800);
};

// ── MINI-GAMES (harder, mobile-friendly) ──

// 1. TAP CHALLENGE — tap 15-30 times (touch-friendly)
const gameTap = (popup, img) => {
    const needed = 15 + Math.floor(Math.random() * 16); // 15–30
    let taps = 0;
    const counter = document.createElement('div');
    counter.className = 'hypno-counter';
    counter.textContent = `👆 0/${needed}`;
    popup.appendChild(counter);

    // Progress bar
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
        const remaining = needed - taps;
        const pct = Math.min(100, (taps / needed) * 100);
        fill.style.width = pct + '%';
        counter.textContent = remaining > 0 ? `👆 ${taps}/${needed}` : '✅';
        popup.style.transform = `scale(${1 + Math.random() * 0.05})`;
        setTimeout(() => popup.style.transform = '', 100);
        if (remaining <= 0) dismissPopup(popup);
    };
    popup.addEventListener('click', onTap);
    popup.addEventListener('touchend', onTap);
};

// 2. HOLD & REVEAL — hold for 3s on blurred image
const gameHold = (popup, img) => {
    img.style.filter = 'blur(20px) brightness(0.4)';
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = '✋ Hold 3s';
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
        holdInterval = setInterval(() => {
            progress += 2;
            const pct = Math.min(100, progress);
            fill.style.width = pct + '%';
            img.style.filter = `blur(${Math.max(0, 20 - progress * 0.2)}px) brightness(${0.4 + progress * 0.006})`;
            label.textContent = `${pct}%`;
            if (progress >= 100) {
                clearInterval(holdInterval);
                img.style.filter = 'none';
                dismissPopup(popup);
            }
        }, 60); // ~3s total (100 / 2 * 60ms)
    };
    const endHold = () => {
        clearInterval(holdInterval);
        if (progress < 100) {
            progress = Math.max(0, progress - 10); // Lose some progress
            const pct = Math.min(100, progress);
            fill.style.width = pct + '%';
            img.style.filter = `blur(${Math.max(0, 20 - progress * 0.2)}px) brightness(${0.4 + progress * 0.006})`;
            label.textContent = progress > 0 ? `${pct}% — keep holding!` : '✋ Hold 3s';
        }
    };

    popup.addEventListener('mousedown', startHold);
    popup.addEventListener('touchstart', startHold);
    popup.addEventListener('mouseup', endHold);
    popup.addEventListener('mouseleave', endHold);
    popup.addEventListener('touchend', endHold);
    popup.addEventListener('touchcancel', endHold);
};

// 3. CATCH ME — image dodges, catch 5 times
const gameCatch = (popup, img) => {
    let catches = 0;
    const needed = 5;
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = `🎯 0/${needed}`;
    popup.appendChild(label);

    let canDodge = true;

    const dodge = () => {
        if (!canDodge) return;
        const maxX = window.innerWidth - popup.offsetWidth - 10;
        const maxY = window.innerHeight - popup.offsetHeight - 10;
        popup.style.left = (10 + Math.random() * maxX) + 'px';
        popup.style.top = (10 + Math.random() * maxY) + 'px';
        popup.style.transition = 'left 0.25s ease, top 0.25s ease';
    };

    // On mobile: dodge on touchstart (fast finger)
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
        const remaining = needed - catches;
        label.textContent = remaining > 0 ? `🎯 ${catches}/${needed}` : '✅';
        if (remaining <= 0) {
            canDodge = false;
            dismissPopup(popup);
        } else {
            canDodge = false;
            popup.style.transform = 'scale(0.9)';
            setTimeout(() => {
                popup.style.transform = '';
                canDodge = true;
            }, 600);
        }
    };
    popup.addEventListener('click', onCatch);
    popup.addEventListener('touchend', onCatch);
};

// 4. PATTERN TAP — tap corners in order (TL, TR, BR, BL)
const gamePattern = (popup, img) => {
    const zones = ['↖', '↗', '↘', '↙'];
    const zoneLabels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
    let step = 0;

    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = `Tap ${zones[0]}`;
    popup.appendChild(label);

    // Create 4 tap zones
    const zoneEls = [];
    const positions = [
        { top: '0', left: '0' },
        { top: '0', right: '0' },
        { bottom: '0', right: '0' },
        { bottom: '0', left: '0' }
    ];
    positions.forEach((pos, i) => {
        const zone = document.createElement('div');
        zone.className = 'hypno-tap-zone';
        zone.dataset.idx = i;
        Object.assign(zone.style, pos, {
            position: 'absolute', width: '50%', height: '50%', zIndex: '5'
        });
        if (i === step) zone.classList.add('hypno-zone-active');
        popup.appendChild(zone);
        zoneEls.push(zone);

        const onTap = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (parseInt(zone.dataset.idx) === step) {
                zone.classList.remove('hypno-zone-active');
                step++;
                if (step >= 4) {
                    label.textContent = '✅';
                    dismissPopup(popup);
                } else {
                    label.textContent = `Tap ${zones[step]}`;
                    zoneEls[step].classList.add('hypno-zone-active');
                }
            } else {
                // Wrong zone — reset!
                step = 0;
                zoneEls.forEach(z => z.classList.remove('hypno-zone-active'));
                zoneEls[0].classList.add('hypno-zone-active');
                label.textContent = `❌ Reset! Tap ${zones[0]}`;
                popup.style.animation = 'none';
                popup.offsetHeight;
                popup.style.animation = 'hypnoShake 0.3s ease';
            }
        };
        zone.addEventListener('click', onTap);
        zone.addEventListener('touchend', onTap);
    });
};

// 5. LONG SWIPE — drag 200px+ to dismiss
const gameSwipe = (popup, img) => {
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = '👉 Drag away';
    popup.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'hypno-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'hypno-progress-fill swipe-fill';
    bar.appendChild(fill);
    popup.appendChild(bar);

    let startX = 0, startY = 0, origLeft = 0, origTop = 0;
    let dragging = false;
    const THRESHOLD = 200;

    const down = (e) => {
        e.preventDefault();
        dragging = true;
        const pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        origLeft = popup.offsetLeft;
        origTop = popup.offsetTop;
        popup.style.transition = 'none';
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
        popup.style.opacity = Math.max(0.2, 1 - dist / (THRESHOLD * 1.5));
        label.textContent = dist > THRESHOLD ? '🚀 Release!' : `${Math.round(pct)}%`;
    };
    const up = (e) => {
        if (!dragging) return;
        dragging = false;
        const pt = e.changedTouches ? e.changedTouches[0] : e;
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > THRESHOLD) {
            dismissPopup(popup);
        } else {
            popup.style.transition = 'left 0.3s ease, top 0.3s ease, opacity 0.3s ease';
            popup.style.left = origLeft + 'px';
            popup.style.top = origTop + 'px';
            popup.style.opacity = '1';
            fill.style.width = '0%';
            label.textContent = '👉 Drag away';
        }
    };

    popup.addEventListener('mousedown', down);
    popup.addEventListener('touchstart', down, { passive: false });
    const mvMouse = (e) => move(e);
    const mvTouch = (e) => move(e);
    const upMouse = (e) => up(e);
    const upTouch = (e) => up(e);
    document.addEventListener('mousemove', mvMouse);
    document.addEventListener('touchmove', mvTouch, { passive: false });
    document.addEventListener('mouseup', upMouse);
    document.addEventListener('touchend', upTouch);
    cleanupFns.push(() => {
        document.removeEventListener('mousemove', mvMouse);
        document.removeEventListener('touchmove', mvTouch);
        document.removeEventListener('mouseup', upMouse);
        document.removeEventListener('touchend', upTouch);
    });
};

// 6. RAPID DOUBLE-TAP — tap twice fast (within 400ms)
const gameDoubleTap = (popup, img) => {
    const label = document.createElement('div');
    label.className = 'hypno-counter';
    label.textContent = '⚡ Double-tap fast!';
    popup.appendChild(label);

    let lastTap = 0;
    let fails = 0;

    const onTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTap < 400) {
            label.textContent = '✅';
            dismissPopup(popup);
        } else {
            lastTap = now;
            // Single tap — spin + slight feedback
            popup.style.animation = 'none';
            popup.offsetHeight;
            popup.style.animation = 'hypnoSpin 0.4s ease';
            fails++;
            if (fails > 3) label.textContent = '⚡ Faster!';
        }
    };
    popup.addEventListener('click', onTap);
    popup.addEventListener('touchend', onTap);
};

const miniGames = [gameTap, gameHold, gameCatch, gamePattern, gameSwipe, gameDoubleTap];

function spawnPopup() {
    if (!hypnoActive || currentPopup || !activeContainer) return;
    const allImages = Gallery.getAll();
    if (allImages.length === 0) return;

    const randImg = allImages[Math.floor(Math.random() * allImages.length)];
    const popup = document.createElement('div');
    popup.className = 'hypno-popup';
    currentPopup = popup;

    const img = document.createElement('img');
    img.src = Gallery.getImageURL(randImg, 400);
    img.alt = '';
    img.draggable = false;
    popup.appendChild(img);

    // Smaller sizes: 120–180px
    const size = 120 + Math.random() * 60;
    const x = 20 + Math.random() * (window.innerWidth - size - 40);
    const y = 80 + Math.random() * (window.innerHeight - size - 160);

    popup.style.cssText = `
        left: ${x}px; top: ${y}px;
        width: ${size}px; height: ${size}px;
        animation: hypnoAppearSoft 0.6s ease-out forwards;
    `;

    activeContainer.appendChild(popup);

    // Pick a random mini-game
    const game = miniGames[Math.floor(Math.random() * miniGames.length)];
    game(popup, img);
}

const HypnoPopups = {
    /** Attach the hypno toggle button to a container. Call once per page render. */
    attach(container) {
        // Cleanup previous if any
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
                Toast.show('Hypnotic mode off');
            } else {
                hypnoActive = true;
                btn.classList.add('active');
                Toast.show('🌀 Mini-games ON!', 'info');
                const id = setTimeout(spawnPopup, 1500);
                hypnoTimers.push(id);
            }
        });

        container.appendChild(btn);
    },

    /** Detach and clean up everything */
    detach() {
        stop();
        activeContainer = null;
    }
};

export default HypnoPopups;
