import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let FaceMesh;
let faceMeshInstance;

// ── MediaPipe FaceMesh landmark indices ──────────────────────────────────────
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const LEFT_IRIS = [474, 475, 476, 477];
const RIGHT_IRIS = [469, 470, 471, 472];
const LEFT_EYE_TOP = [130, 247, 30, 29, 27, 28, 56, 190, 244, 112, 26, 22, 23, 24, 110, 25];
const RIGHT_EYE_TOP = [359, 467, 260, 259, 257, 258, 286, 414, 464, 341, 256, 252, 253, 254, 339, 255];

// Joues : points autour des pommettes pour le blush
const LEFT_CHEEK = [116, 123, 147, 187, 207, 206, 203, 36, 31, 228, 229, 230, 231, 232, 233, 244, 143, 111];
const RIGHT_CHEEK = [345, 352, 376, 411, 427, 426, 423, 266, 261, 448, 449, 450, 451, 452, 453, 464, 372, 340];

// Contour visage pour le contouring
const FACE_OUTLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
    152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

// Zone front pour le fond de teint
const FOREHEAD = [10, 109, 67, 103, 54, 21, 162, 127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
    377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338];

const FaceEditor = {
    _modal: null,
    _canvas: null,
    _ctx: null,
    _imgEl: null,
    _initializing: false,

    _settings: {
        // Lèvres
        lipColor: '#c4004e', lipIntensity: 0.0, lipThickness: 1.0,
        // Yeux
        eyeColor: '#00aaff', eyeIntensity: 0.0,
        // Maquillage (fard à paupières)
        makeupColor: '#4a0080', makeupIntensity: 0.0,
        // Blush
        blushColor: '#ff6b8a', blushIntensity: 0.0,
        // Contouring
        contourIntensity: 0.0,
        // Fond de teint / lissage
        smoothIntensity: 0.0,
        foundationColor: '#f5c5a0', foundationIntensity: 0.0,
    },

    // ── Init MediaPipe ────────────────────────────────────────────────────
    async init() {
        if (FaceMesh) return;
        if (this._initializing) return;
        this._initializing = true;
        try {
            Toast.show('Chargement des modèles IA…', 'info', 3000);
            await this._loadScripts();
            FaceMesh = window.FaceMesh;
            faceMeshInstance = new FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMeshInstance.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });
            faceMeshInstance.onResults(this._onResults.bind(this));
        } finally {
            this._initializing = false;
        }
    },

    async _loadScripts() {
        const load = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src; s.onload = resolve;
            s.onerror = () => reject(new Error(`Script error: ${src}`));
            document.body.appendChild(s);
        });
        await Promise.all([
            load('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
            load('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'),
        ]);
    },

    // ── Ouverture ────────────────────────────────────────────────────────
    async open(imageObj) {
        if (imageObj._isLocal) {
            Toast.show('AI Retouch indisponible pour les images locales (upload d\'abord)', 'error', 3500);
            return;
        }
        this._cachedLandmarks = null;
        this._settings = {
            lipColor: '#c4004e', lipIntensity: 0.0, lipThickness: 1.0,
            eyeColor: '#00aaff', eyeIntensity: 0.0,
            makeupColor: '#4a0080', makeupIntensity: 0.0,
            blushColor: '#ff6b8a', blushIntensity: 0.0,
            contourIntensity: 0.0,
            smoothIntensity: 0.0,
            foundationColor: '#f5c5a0', foundationIntensity: 0.0,
        };
        this._buildUI();
        this._showLoading(true);
        await this.init();

        // Chargement CORS avec fallback wsrv.nl
        const loadWithCORS = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
        const srcHD = Gallery.getImageURL(imageObj, 1080);
        const srcProxy = `https://wsrv.nl/?url=${encodeURIComponent(srcHD)}&output=jpg&n=-1`;

        let img;
        try {
            img = await loadWithCORS(srcHD).catch(() => {
                console.warn('[FaceEditor] Direct CORS failed, using wsrv.nl');
                return loadWithCORS(srcProxy);
            });
        } catch (err) {
            console.error('[FaceEditor] Image load failed:', err);
            if (this._modal) { Toast.show('Impossible de charger cette image.', 'error'); this._showLoading(false); }
            return;
        }

        if (!this._modal) return;
        this._imgEl = img;
        this._canvas.width = img.naturalWidth;
        this._canvas.height = img.naturalHeight;
        this._ctx.drawImage(img, 0, 0);

        try {
            await faceMeshInstance.send({ image: img });
        } catch (err) {
            console.error('[FaceEditor] FaceMesh error:', err);
            Toast.show('Impossible de détecter le visage.', 'error');
            this._showLoading(false);
        }
    },

    // ── Construction du modal ────────────────────────────────────────────
    _buildUI() {
        if (this._modal) this._modal.remove();
        this._modal = document.createElement('div');
        this._modal.className = 'face-editor-modal';
        this._modal.innerHTML = `
            <div class="fe-header">
                <button class="fe-close-btn" aria-label="Fermer">✕</button>
                <h3>🪄 AI Retouch</h3>
                <button class="fe-save-btn">Enregistrer</button>
            </div>
            <div class="fe-canvas-container">
                <canvas id="fe-canvas"></canvas>
                <div id="fe-loading" class="fe-loading-overlay">
                    <div class="fe-spinner"></div>
                    <p>Analyse du visage…</p>
                </div>
            </div>
            <div class="fe-toolbar">
                <div class="fe-tabs">
                    <button class="fe-tab active" data-target="lips">💋 Lèvres</button>
                    <button class="fe-tab" data-target="eyes">👁️ Yeux</button>
                    <button class="fe-tab" data-target="blush">🌸 Blush</button>
                    <button class="fe-tab" data-target="skin">✨ Peau</button>
                </div>
                <div class="fe-panels">

                    <div class="fe-panel active" id="panel-lips">
                        <div class="fe-control">
                            <label>Épaisseur <span id="val-thickness">1.00</span></label>
                            <input type="range" id="sl-lip-thickness" min="0.75" max="1.45" step="0.05" value="1.0">
                        </div>
                        <div class="fe-control">
                            <label>Couleur & intensité <span id="val-lip-int">0%</span></label>
                            <input type="range" id="sl-lip-intensity" min="0" max="1" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Teinte lèvres</label>
                            <input type="color" id="cl-lip-color" value="#c4004e">
                        </div>
                    </div>

                    <div class="fe-panel" id="panel-eyes">
                        <div class="fe-control">
                            <label>Fard à paupières <span id="val-makeup-int">0%</span></label>
                            <input type="range" id="sl-makeup-intensity" min="0" max="0.85" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Couleur fard</label>
                            <input type="color" id="cl-makeup-color" value="#4a0080">
                        </div>
                        <div class="fe-control">
                            <label>Couleur iris <span id="val-eye-int">0%</span></label>
                            <input type="range" id="sl-eye-intensity" min="0" max="0.9" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Teinte iris</label>
                            <input type="color" id="cl-eye-color" value="#00aaff">
                        </div>
                    </div>

                    <div class="fe-panel" id="panel-blush">
                        <div class="fe-control">
                            <label>Blush <span id="val-blush-int">0%</span></label>
                            <input type="range" id="sl-blush-intensity" min="0" max="0.8" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Couleur blush</label>
                            <input type="color" id="cl-blush-color" value="#ff6b8a">
                        </div>
                        <div class="fe-control">
                            <label>Contouring <span id="val-contour-int">0%</span></label>
                            <input type="range" id="sl-contour-intensity" min="0" max="0.6" step="0.05" value="0">
                        </div>
                    </div>

                    <div class="fe-panel" id="panel-skin">
                        <div class="fe-control">
                            <label>Lissage peau <span id="val-smooth-int">0%</span></label>
                            <input type="range" id="sl-smooth-intensity" min="0" max="1" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Fond de teint <span id="val-foundation-int">0%</span></label>
                            <input type="range" id="sl-foundation-intensity" min="0" max="0.6" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Teinte fond</label>
                            <input type="color" id="cl-foundation-color" value="#f5c5a0">
                        </div>
                    </div>

                </div>
                <div class="fe-footer-actions">
                    <button class="fe-reset-btn">↺ Réinitialiser</button>
                </div>
            </div>
        `;
        document.body.appendChild(this._modal);
        this._canvas = this._modal.querySelector('#fe-canvas');
        this._ctx = this._canvas.getContext('2d');

        this._modal.querySelector('.fe-close-btn').onclick = () => this._close();
        this._modal.querySelector('.fe-save-btn').onclick = () => this._save();

        this._modal.querySelector('.fe-reset-btn').onclick = () => {
            this._settings = {
                lipColor: '#c4004e', lipIntensity: 0.0, lipThickness: 1.0,
                eyeColor: '#00aaff', eyeIntensity: 0.0,
                makeupColor: '#4a0080', makeupIntensity: 0.0,
                blushColor: '#ff6b8a', blushIntensity: 0.0,
                contourIntensity: 0.0,
                smoothIntensity: 0.0,
                foundationColor: '#f5c5a0', foundationIntensity: 0.0,
            };
            this._modal.querySelectorAll('input[type="range"]').forEach(el => { el.value = el.defaultValue; });
            this._modal.querySelector('#cl-lip-color').value = '#c4004e';
            this._modal.querySelector('#cl-eye-color').value = '#00aaff';
            this._modal.querySelector('#cl-makeup-color').value = '#4a0080';
            this._modal.querySelector('#cl-blush-color').value = '#ff6b8a';
            this._modal.querySelector('#cl-foundation-color').value = '#f5c5a0';
            ['val-thickness', 'val-lip-int', 'val-eye-int', 'val-makeup-int',
                'val-blush-int', 'val-contour-int', 'val-smooth-int', 'val-foundation-int']
                .forEach(id => {
                    const el = this._modal.querySelector('#' + id);
                    if (el) el.textContent = id === 'val-thickness' ? '1.00' : '0%';
                });
            this._render();
        };

        this._modal.querySelectorAll('.fe-tab').forEach(btn => {
            btn.onclick = () => {
                this._modal.querySelectorAll('.fe-tab, .fe-panel').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                this._modal.querySelector('#panel-' + btn.dataset.target).classList.add('active');
            };
        });

        const bind = (id, key, valId, isPercent) => {
            const el = this._modal.querySelector('#' + id);
            if (!el) return;
            el.oninput = () => {
                this._settings[key] = el.type === 'color' ? el.value : parseFloat(el.value);
                if (valId && el.type !== 'color') {
                    const display = this._modal.querySelector('#' + valId);
                    if (display) display.textContent = isPercent ? Math.round(parseFloat(el.value) * 100) + '%' : parseFloat(el.value).toFixed(2);
                }
                this._render();
            };
        };
        bind('sl-lip-thickness', 'lipThickness', 'val-thickness', false);
        bind('sl-lip-intensity', 'lipIntensity', 'val-lip-int', true);
        bind('cl-lip-color', 'lipColor');
        bind('sl-eye-intensity', 'eyeIntensity', 'val-eye-int', true);
        bind('cl-eye-color', 'eyeColor');
        bind('sl-makeup-intensity', 'makeupIntensity', 'val-makeup-int', true);
        bind('cl-makeup-color', 'makeupColor');
        bind('sl-blush-intensity', 'blushIntensity', 'val-blush-int', true);
        bind('cl-blush-color', 'blushColor');
        bind('sl-contour-intensity', 'contourIntensity', 'val-contour-int', true);
        bind('sl-smooth-intensity', 'smoothIntensity', 'val-smooth-int', true);
        bind('sl-foundation-intensity', 'foundationIntensity', 'val-foundation-int', true);
        bind('cl-foundation-color', 'foundationColor');
    },

    _showLoading(v) {
        const el = this._modal?.querySelector('#fe-loading');
        if (el) el.style.display = v ? 'flex' : 'none';
    },

    _close() {
        this._modal?.remove();
        this._modal = null;
    },

    // ── Résultats MediaPipe ───────────────────────────────────────────────
    _onResults(results) {
        this._showLoading(false);
        if (!this._modal) return;
        if (results.multiFaceLandmarks?.length > 0) {
            this._cachedLandmarks = results.multiFaceLandmarks[0];
            Toast.show('Visage détecté ! 🎨', 'success', 2000);
            this._render();
        } else {
            Toast.show('Aucun visage détecté', 'error');
        }
    },

    // ── Helpers géométriques ─────────────────────────────────────────────
    _pt(idx, lms, w, h) { return { x: lms[idx].x * w, y: lms[idx].y * h }; },
    _center(indices, lms, w, h) {
        let cx = 0, cy = 0;
        indices.forEach(i => { cx += lms[i].x * w; cy += lms[i].y * h; });
        return { x: cx / indices.length, y: cy / indices.length };
    },
    _poly(ctx, indices, lms, w, h, scale = 1, cx = 0, cy = 0) {
        ctx.beginPath();
        indices.forEach((idx, i) => {
            const x = cx + (lms[idx].x * w - cx) * scale;
            const y = cy + (lms[idx].y * h - cy) * scale;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
    },

    // ── Rendu principal ──────────────────────────────────────────────────
    _render() {
        if (!this._imgEl || !this._ctx || !this._modal) return;
        const { width: w, height: h } = this._canvas;
        const ctx = this._ctx;
        const lms = this._cachedLandmarks;

        // Reset
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        ctx.drawImage(this._imgEl, 0, 0, w, h);
        if (!lms) return;

        // Ordre d'application : fond → peau → contouring → blush → fard → iris → lèvres
        this._drawFoundation(lms, w, h);
        this._drawSmooth(lms, w, h);
        this._drawContour(lms, w, h);
        this._drawBlush(lms, w, h);
        this._drawMakeup(lms, w, h);
        this._drawIrises(lms, w, h);
        this._drawLips(lms, w, h);

        // Reset final
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
    },

    // ── Fond de teint ───────────────────────────────────────────────────
    _drawFoundation(lms, w, h) {
        const alpha = this._settings.foundationIntensity;
        if (alpha === 0) return;
        const ctx = this._ctx;
        ctx.save();
        const blurPx = Math.max(6, w * 0.012);
        this._poly(ctx, FOREHEAD, lms, w, h);
        ctx.filter = `blur(${blurPx}px)`;
        ctx.globalCompositeOperation = 'color';
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = this._settings.foundationColor;
        ctx.fill();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = alpha * 0.25;
        ctx.fill();
        ctx.restore();
    },

    // ── Lissage peau (flou centré sur le visage) ─────────────────────────
    _drawSmooth(lms, w, h) {
        const alpha = this._settings.smoothIntensity;
        if (alpha === 0) return;
        const ctx = this._ctx;
        ctx.save();
        this._poly(ctx, FOREHEAD, lms, w, h);
        ctx.clip();
        // Superposition floue de l'image elle-même sur le visage
        const blurPx = Math.round(alpha * w * 0.008);
        ctx.filter = `blur(${blurPx}px)`;
        ctx.globalAlpha = alpha * 0.55;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.drawImage(this._imgEl, 0, 0, w, h);
        ctx.restore();
    },

    // ── Contouring ───────────────────────────────────────────────────────
    _drawContour(lms, w, h) {
        const alpha = this._settings.contourIntensity;
        if (alpha === 0) return;
        const ctx = this._ctx;
        ctx.save();
        const blurPx = Math.max(16, w * 0.03);
        // Ombre sombre sur le contour
        ctx.filter = `blur(${blurPx}px)`;
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = '#5a3010';
        this._poly(ctx, FACE_OUTLINE, lms, w, h);
        const olCenter = this._center(FACE_OUTLINE, lms, w, h);
        // Peindre AUTOUR du visage = on dessine le poly légèrement élargi puis on clip l'intérieur
        // => Méthode simplifiée : on dessine juste les bords du contour
        ctx.fill();
        ctx.restore();
    },

    // ── Blush ────────────────────────────────────────────────────────────
    _drawBlush(lms, w, h) {
        const alpha = this._settings.blushIntensity;
        if (alpha === 0) return;
        const ctx = this._ctx;
        const blurPx = Math.max(20, w * 0.05);

        [LEFT_CHEEK, RIGHT_CHEEK].forEach(cheek => {
            const c = this._center(cheek, lms, w, h);
            const r = Math.max(w * 0.07, 40);
            ctx.save();
            const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
            grad.addColorStop(0, this._settings.blushColor + 'cc');
            grad.addColorStop(1, this._settings.blushColor + '00');
            ctx.filter = `blur(${blurPx}px)`;
            ctx.globalAlpha = alpha * 0.7;
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r * 1.4, 0, Math.PI * 2);
            ctx.fill();
            // Couche overlay pour saturation
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = alpha * 0.15;
            ctx.fillStyle = this._settings.blushColor;
            ctx.fill();
            ctx.restore();
        });
    },

    // ── Fard à paupières ─────────────────────────────────────────────────
    _drawMakeup(lms, w, h) {
        if (this._settings.makeupIntensity === 0) return;
        const ctx = this._ctx;
        const blurPx = Math.max(4, w * 0.015);
        ctx.save();
        ctx.filter = `blur(${blurPx}px)`;
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = this._settings.makeupIntensity * 0.7;
        ctx.fillStyle = this._settings.makeupColor;
        [LEFT_EYE_TOP, RIGHT_EYE_TOP].forEach(eyePoly => {
            this._poly(ctx, eyePoly, lms, w, h);
            ctx.fill();
        });
        // Couche color pour teinte
        ctx.globalCompositeOperation = 'color';
        ctx.globalAlpha = this._settings.makeupIntensity * 0.5;
        [LEFT_EYE_TOP, RIGHT_EYE_TOP].forEach(eyePoly => {
            this._poly(ctx, eyePoly, lms, w, h);
            ctx.fill();
        });
        ctx.restore();
    },

    // ── Iris ─────────────────────────────────────────────────────────────
    _drawIrises(lms, w, h) {
        if (this._settings.eyeIntensity === 0) return;
        const ctx = this._ctx;
        ctx.save();
        ctx.filter = 'blur(2px)';
        [LEFT_IRIS, RIGHT_IRIS].forEach(iris => {
            const c = this._center(iris, lms, w, h);
            const p = this._pt(iris[0], lms, w, h);
            const r = Math.hypot(p.x - c.x, p.y - c.y) * 1.15;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx.globalCompositeOperation = 'color';
            ctx.globalAlpha = this._settings.eyeIntensity * 0.8;
            ctx.fillStyle = this._settings.eyeColor;
            ctx.fill();
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = this._settings.eyeIntensity * 0.4;
            ctx.fill();
        });
        ctx.restore();
    },

    // ── Lèvres ───────────────────────────────────────────────────────────
    _drawLips(lms, w, h) {
        const { lipIntensity: intens, lipThickness: t, lipColor } = this._settings;
        if (t === 1.0 && intens === 0) return;
        const ctx = this._ctx;
        const outerCenter = this._center(LIPS_OUTER, lms, w, h);

        // Épaisseur (warp vers le centre)
        if (t !== 1.0) {
            ctx.save();
            this._poly(ctx, LIPS_OUTER, lms, w, h, t, outerCenter.x, outerCenter.y);
            ctx.clip();
            ctx.translate(outerCenter.x, outerCenter.y);
            ctx.scale(t, t);
            ctx.translate(-outerCenter.x, -outerCenter.y);
            ctx.drawImage(this._imgEl, 0, 0, w, h);
            ctx.restore();
        }

        // Couleur — double couche pour un rendu naturel
        if (intens > 0) {
            const blurPx = Math.max(3, w * 0.004);
            ctx.save();
            this._poly(ctx, LIPS_OUTER, lms, w, h, t, outerCenter.x, outerCenter.y);
            ctx.filter = `blur(${blurPx}px)`;
            // Couche multiply pour assombrir légèrement
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = intens * 0.55;
            ctx.fillStyle = lipColor;
            ctx.fill();
            // Couche overlay pour la vivacité
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = intens * 0.5;
            ctx.fill();
            // Couche color pour la teinte finale
            ctx.globalCompositeOperation = 'color';
            ctx.globalAlpha = intens * 0.75;
            ctx.fill();
            ctx.restore();
        }
    },

    // ── Sauvegarde ───────────────────────────────────────────────────────
    async _save() {
        const saveBtn = this._modal?.querySelector('.fe-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳…'; }
        this._canvas.toBlob(async (blob) => {
            if (!blob) {
                Toast.show('Impossible de capturer le canvas', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer'; }
                return;
            }
            const file = new File([blob], `retouch_${Date.now()}.jpg`, { type: 'image/jpeg' });
            this._close();
            Toast.show('⬆️ Envoi vers Google Photos…', 'info', 3000);
            try {
                await Gallery.uploadImages([file], {
                    onFileComplete: () => Toast.show('✅ Retouch enregistré !', 'success', 3000),
                    onFileError: () => Toast.show('❌ Échec de l\'envoi', 'error'),
                });
                setTimeout(() => Gallery.fetchAllImages(), 6000);
            } catch (err) {
                console.error('[FaceEditor] save error:', err);
                Toast.show('Erreur lors de l\'enregistrement', 'error');
            }
        }, 'image/jpeg', 0.95);
    },
};

export default FaceEditor;
