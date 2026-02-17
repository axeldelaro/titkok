/* ── Hypnotic Popup: SUBLIMINAL MODE ──
 * 95% Ghostly fleeting images (visual only)
 * 5% Mini-games (interactive)
 * High frequency, overlapping, subliminal feel.
 */
import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let hypnoActive = false;
let hypnoTimers = [];
let activePopups = new Set();
let activeContainer = null;
const MAX_POPUPS = 25; // Increased limit for subliminal flooding

// ── Mini-Game Utils ──
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

const dismissPopup = (popup, isGame = true) => {
    if (popup._cleanup) popup._cleanup();
    activePopups.delete(popup);

    if (isGame) {
        popup.classList.add('hypno-solved');
        setTimeout(() => popup.remove(), 600);
    } else {
        // Fleets just fade out naturally or removed
        popup.remove();
    }
};

const scheduleSpawn = (delay) => {
    if (!hypnoActive) return;
    const id = setTimeout(spawnPopup, delay);
    hypnoTimers.push(id);
};

// ── MINI-GAMES (Rare 5%) ──
// ... (Keeping the same game logic, just creating helper functions)

const runGame = (popup, img, type) => {
    // 1. TAP (30-50)
    if (type === 0) {
        const needed = 20 + Math.floor(Math.random() * 20);
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
            e.preventDefault(); e.stopPropagation();
            taps++;
            fill.style.width = Math.min(100, (taps / needed) * 100) + '%';
            counter.textContent = `👆 ${taps}/${needed}`;
            popup.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px) scale(${1 + Math.random() * 0.1})`;
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
        label.textContent = '✋ Hold 4s';
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
    // 3. CATCH (8x)
    else if (type === 2) {
        let catches = 0;
        const needed = 6;
        const label = document.createElement('div');
        label.className = 'hypno-counter';
        label.textContent = `🎯 0/${needed}`;
        popup.appendChild(label);
        let canDodge = true;
        const dodge = () => {
            if (!canDodge) return;
            popup.style.left = Math.random() * (window.innerWidth - popup.offsetWidth) + 'px';
            popup.style.top = Math.random() * (window.innerHeight - popup.offsetHeight) + 'px';
        };
        popup.addEventListener('touchstart', (e) => { e.preventDefault(); if (canDodge) dodge(); }, { passive: false });
        popup.addEventListener('mouseenter', () => { if (canDodge) dodge(); });
        popup.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            catches++;
            label.textContent = `🎯 ${catches}/${needed}`;
            canDodge = false;
            popup.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if (catches >= needed) dismissPopup(popup);
                else { canDodge = true; popup.style.transform = ''; dodge(); }
            }, 300);
        });
    }
    // 4. SWIPE (300px)
    else {
        const label = document.createElement('div');
        label.className = 'hypno-counter';
        label.textContent = '👉 Drag Away';
        popup.appendChild(label);
        let startX, startY, dragging = false;
        const down = (e) => {
            dragging = true;
            const pt = e.touches ? e.touches[0] : e;
            startX = pt.clientX; startY = pt.clientY;
            popup.style.zIndex = 10000;
        };
        const move = (e) => {
            if (!dragging) return;
            e.preventDefault();
            const pt = e.touches ? e.touches[0] : e;
            const dx = pt.clientX - startX;
            const dy = pt.clientY - startY;
            popup.style.transform = `translate(${dx}px, ${dy}px)`;
            if (Math.hypot(dx, dy) > 250) {
                dragging = false;
                dismissPopup(popup);
            }
        };
        const up = () => {
            dragging = false;
            popup.style.transform = '';
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
    if (allImages.length === 0) return;

    // Prune if too many (mostly remove old fleets)
    if (activePopups.size >= MAX_POPUPS) {
        const it = activePopups.values();
        const first = it.next().value;
        if (first && !first.classList.contains('hypno-game')) {
            first.remove();
            activePopups.delete(first);
        } else {
            return; // Wait if only games are left (unlikely)
        }
    }

    const randImg = allImages[Math.floor(Math.random() * allImages.length)];
    const popup = document.createElement('div');
    popup.className = 'hypno-popup';

    const img = document.createElement('img');
    img.src = Gallery.getImageURL(randImg, 400);
    img.draggable = false;
    popup.appendChild(img);

    // 5% chance of Mini-Game vs 95% Ghostly Fleet
    const isGame = Math.random() < 0.05;

    const size = isGame ? (150 + Math.random() * 100) : (100 + Math.random() * 250);
    const x = Math.random() * (window.innerWidth - size);
    const y = Math.random() * (window.innerHeight - size);

    // Subliminal / Fleet Style
    if (!isGame) {
        popup.classList.add('hypno-fleet');
        popup.style.cssText = `
            left: ${x}px; top: ${y}px;
            width: ${size}px; height: ${size}px;
            opacity: 0;
            transform: scale(${0.5 + Math.random()}) rotate(${Math.random() * 60 - 30}deg);
            pointer-events: none; /* CLICK-THROUGH */
            transition: opacity 0.5s ease;
            z-index: ${100 + Math.floor(Math.random() * 100)};
            filter: grayscale(${Math.random()}) contrast(1.2) opacity(0.7);
        `;
        // Animate visually
        requestAnimationFrame(() => {
            popup.style.opacity = 0.4 + Math.random() * 0.4; // Semi-transparent
            setTimeout(() => {
                popup.style.opacity = 0;
                setTimeout(() => {
                    if (popup.parentNode) popup.remove();
                    activePopups.delete(popup);
                }, 1000);
            }, 800 + Math.random() * 1500); // Disappear after 0.8-2.3s
        });
    } else {
        // Game Style (Interactive)
        popup.classList.add('hypno-game');
        popup.style.cssText = `
            left: ${x}px; top: ${y}px;
            width: ${size}px; height: ${size}px;
            animation: hypnoAppearSoft 0.4s ease-out forwards;
            z-index: 999;
        `;
        // Attach random game
        runGame(popup, img, Math.floor(Math.random() * 4));
    }

    activeContainer.appendChild(popup);
    activePopups.add(popup);

    // Rapid fire schedule
    scheduleSpawn(100 + Math.random() * 400); // 0.1s - 0.5s interval
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
                Toast.show('Hypnotic mode off');
            } else {
                hypnoActive = true;
                btn.classList.add('active');
                Toast.show('🌀 SUBLIMINAL MODE', 'info');
                scheduleSpawn(200);
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
