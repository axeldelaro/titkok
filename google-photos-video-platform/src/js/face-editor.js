import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let FaceMesh;
let faceMeshInstance;

const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LEFT_IRIS = [474, 475, 476, 477];
const RIGHT_IRIS = [469, 470, 471, 472];
const LEFT_EYE_TOP = [130, 247, 30, 29, 27, 28, 56, 190, 244, 112, 26, 22, 23, 24, 110, 25];
const RIGHT_EYE_TOP = [359, 467, 260, 259, 257, 258, 286, 414, 464, 341, 256, 252, 253, 254, 339, 255];

const FaceEditor = {
    _modal: null,
    _canvas: null,
    _ctx: null,
    _imgEl: null,
    _blobUrl: null,
    _originalImageObj: null,
    _cachedLandmarks: null,
    _initializing: false,

    _settings: {
        lipColor: '#ff0055', lipIntensity: 0.0, lipThickness: 1.0,
        eyeColor: '#00aaff', eyeIntensity: 0.0,
        makeupColor: '#111111', makeupIntensity: 0.0,
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
                minTrackingConfidence: 0.5
            });
            faceMeshInstance.onResults(this._onResults.bind(this));
        } finally {
            this._initializing = false;
        }
    },

    // Chargement parallèle des scripts (sans recharger si déjà présents)
    async _loadScripts() {
        const load = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
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

        this._originalImageObj = imageObj;
        this._cachedLandmarks = null;
        this._settings = {
            lipColor: '#ff0055', lipIntensity: 0.0, lipThickness: 1.0,
            eyeColor: '#00aaff', eyeIntensity: 0.0,
            makeupColor: '#111111', makeupIntensity: 0.0,
        };

        this._buildUI();
        this._showLoading(true);
        await this.init();

        // ── Chargement de l'image via fetch → blob ──────────────────────
        // Les URLs Google Photos ont des restrictions CORS qui peuvent
        // corrompre le canvas (tainting). En passant par fetch → blob URL
        // on crée une URL locale propre, sans problème CORS, compatible
        // avec MediaPipe et toBlob().
        const tryFetch = async (url) => {
            const res = await fetch(url, { credentials: 'omit' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.blob();
        };

        try {
            // Tentative 1080p, fallback 512p
            const url1080 = Gallery.getImageURL(imageObj, 1080);
            const url512 = Gallery.getImageURL(imageObj, 512);
            const blob = await tryFetch(url1080).catch(() => tryFetch(url512));

            if (!this._modal) return; // fermé pendant le fetch

            // Libérer l'ancien blob si existait
            if (this._blobUrl) URL.revokeObjectURL(this._blobUrl);
            this._blobUrl = URL.createObjectURL(blob);

            this._imgEl = new Image();
            this._imgEl.onload = async () => {
                if (!this._modal) return;
                this._canvas.width = this._imgEl.naturalWidth;
                this._canvas.height = this._imgEl.naturalHeight;
                this._ctx.drawImage(this._imgEl, 0, 0);
                try {
                    await faceMeshInstance.send({ image: this._imgEl });
                } catch (err) {
                    console.error('[FaceEditor] FaceMesh error:', err);
                    Toast.show('Impossible de détecter le visage. Essaie une autre image.', 'error');
                    this._showLoading(false);
                }
            };
            this._imgEl.onerror = () => {
                Toast.show('Erreur lors du chargement de l\'image.', 'error');
                this._showLoading(false);
            };
            this._imgEl.src = this._blobUrl;

        } catch (err) {
            console.error('[FaceEditor] Fetch image failed:', err);
            if (this._modal) {
                Toast.show('Impossible de charger l\'image — vérifie ta connexion.', 'error');
                this._showLoading(false);
            }
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
                    <button class="fe-tab active" data-target="lips">Lèvres 💋</button>
                    <button class="fe-tab" data-target="eyes">Yeux 👁️</button>
                    <button class="fe-tab" data-target="makeup">Maquillage 💄</button>
                </div>

                <div class="fe-panels">
                    <div class="fe-panel active" id="panel-lips">
                        <div class="fe-control">
                            <label>Épaisseur <span id="val-thickness">1.00</span></label>
                            <input type="range" id="sl-lip-thickness" min="0.8" max="1.5" step="0.05" value="1.0">
                        </div>
                        <div class="fe-control">
                            <label>Intensité couleur <span id="val-lip-int">0%</span></label>
                            <input type="range" id="sl-lip-intensity" min="0" max="1" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Teinte</label>
                            <input type="color" id="cl-lip-color" value="#ff0055">
                        </div>
                    </div>

                    <div class="fe-panel" id="panel-eyes">
                        <div class="fe-control">
                            <label>Intensité couleur <span id="val-eye-int">0%</span></label>
                            <input type="range" id="sl-eye-intensity" min="0" max="1" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Teinte</label>
                            <input type="color" id="cl-eye-color" value="#00aaff">
                        </div>
                    </div>

                    <div class="fe-panel" id="panel-makeup">
                        <div class="fe-control">
                            <label>Fard à paupières <span id="val-makeup-int">0%</span></label>
                            <input type="range" id="sl-makeup-intensity" min="0" max="0.8" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Couleur</label>
                            <input type="color" id="cl-makeup-color" value="#111111">
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
                lipColor: '#ff0055', lipIntensity: 0.0, lipThickness: 1.0,
                eyeColor: '#00aaff', eyeIntensity: 0.0,
                makeupColor: '#111111', makeupIntensity: 0.0,
            };
            this._modal.querySelector('#sl-lip-thickness').value = 1.0;
            this._modal.querySelector('#sl-lip-intensity').value = 0;
            this._modal.querySelector('#sl-eye-intensity').value = 0;
            this._modal.querySelector('#sl-makeup-intensity').value = 0;
            this._modal.querySelector('#cl-lip-color').value = '#ff0055';
            this._modal.querySelector('#cl-eye-color').value = '#00aaff';
            this._modal.querySelector('#cl-makeup-color').value = '#111111';
            this._modal.querySelector('#val-thickness').textContent = '1.00';
            this._modal.querySelector('#val-lip-int').textContent = '0%';
            this._modal.querySelector('#val-eye-int').textContent = '0%';
            this._modal.querySelector('#val-makeup-int').textContent = '0%';
            this._render();
        };

        this._modal.querySelectorAll('.fe-tab').forEach(btn => {
            btn.onclick = () => {
                this._modal.querySelectorAll('.fe-tab').forEach(b => b.classList.remove('active'));
                this._modal.querySelectorAll('.fe-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                this._modal.querySelector('#panel-' + btn.dataset.target).classList.add('active');
            };
        });

        const bind = (id, key, valId, isPercent) => {
            const el = this._modal.querySelector('#' + id);
            if (!el) return;
            el.oninput = () => {
                const v = el.type === 'color' ? el.value : parseFloat(el.value);
                this._settings[key] = v;
                if (valId && el.type !== 'color') {
                    this._modal.querySelector('#' + valId).textContent =
                        isPercent ? Math.round(v * 100) + '%' : v.toFixed(2);
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
    },

    _showLoading(visible) {
        const el = this._modal?.querySelector('#fe-loading');
        if (el) el.style.display = visible ? 'flex' : 'none';
    },

    _close() {
        if (this._blobUrl) { URL.revokeObjectURL(this._blobUrl); this._blobUrl = null; }
        if (this._modal) { this._modal.remove(); this._modal = null; }
    },

    // ── Callback MediaPipe ───────────────────────────────────────────────
    _onResults(results) {
        this._showLoading(false);
        if (!this._modal) return;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this._cachedLandmarks = results.multiFaceLandmarks[0];
            Toast.show('Visage détecté ! Applique tes retouches 🎨', 'success', 2000);
            this._render();
        } else {
            Toast.show('Aucun visage détecté', 'error');
        }
    },

    // ── Rendu ────────────────────────────────────────────────────────────
    _render() {
        if (!this._imgEl || !this._ctx || !this._modal) return;
        const { width: w, height: h } = this._canvas;

        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.globalAlpha = 1;
        this._ctx.filter = 'none';
        this._ctx.drawImage(this._imgEl, 0, 0, w, h);

        if (!this._cachedLandmarks) return;
        const lms = this._cachedLandmarks;

        this._drawLips(lms, w, h);
        this._drawIrises(lms, w, h);
        this._drawMakeup(lms, w, h);
    },

    _getCenter(indices, lms, w, h) {
        let cx = 0, cy = 0;
        indices.forEach(i => { cx += lms[i].x * w; cy += lms[i].y * h; });
        return { x: cx / indices.length, y: cy / indices.length };
    },

    _drawLips(lms, w, h) {
        const t = this._settings.lipThickness;
        const intensity = this._settings.lipIntensity;
        if (t === 1.0 && intensity === 0) return;

        const center = this._getCenter(LIPS_OUTER, lms, w, h);

        if (t !== 1.0) {
            this._ctx.save();
            this._ctx.beginPath();
            LIPS_OUTER.forEach((idx, i) => {
                const sx = center.x + (lms[idx].x * w - center.x) * t;
                const sy = center.y + (lms[idx].y * h - center.y) * t;
                i === 0 ? this._ctx.moveTo(sx, sy) : this._ctx.lineTo(sx, sy);
            });
            this._ctx.closePath();
            this._ctx.clip();
            this._ctx.translate(center.x, center.y);
            this._ctx.scale(t, t);
            this._ctx.translate(-center.x, -center.y);
            this._ctx.drawImage(this._imgEl, 0, 0, w, h);
            this._ctx.restore();
        }

        if (intensity > 0) {
            this._ctx.save();
            this._ctx.beginPath();
            LIPS_OUTER.forEach((idx, i) => {
                const x = center.x + (lms[idx].x * w - center.x) * t;
                const y = center.y + (lms[idx].y * h - center.y) * t;
                i === 0 ? this._ctx.moveTo(x, y) : this._ctx.lineTo(x, y);
            });
            this._ctx.closePath();
            this._ctx.filter = 'blur(4px)';
            this._ctx.globalCompositeOperation = 'overlay';
            this._ctx.globalAlpha = intensity * 0.5;
            this._ctx.fillStyle = this._settings.lipColor;
            this._ctx.fill();
            this._ctx.globalCompositeOperation = 'color';
            this._ctx.globalAlpha = intensity * 0.8;
            this._ctx.fill();
            this._ctx.filter = 'none';
            this._ctx.globalAlpha = 1;
            this._ctx.globalCompositeOperation = 'source-over';
            this._ctx.restore();
        }
    },

    _drawIrises(lms, w, h) {
        if (this._settings.eyeIntensity === 0) return;
        this._ctx.save();
        this._ctx.globalCompositeOperation = 'color';
        this._ctx.fillStyle = this._settings.eyeColor;
        this._ctx.filter = 'blur(2px)';
        this._ctx.globalAlpha = this._settings.eyeIntensity;

        const drawIris = (indices) => {
            const center = this._getCenter(indices, lms, w, h);
            const p1 = lms[indices[0]];
            const r = Math.hypot(p1.x * w - center.x, p1.y * h - center.y) * 1.2;
            this._ctx.beginPath();
            this._ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
            this._ctx.fill();
            this._ctx.globalCompositeOperation = 'overlay';
            this._ctx.globalAlpha = this._settings.eyeIntensity * 0.5;
            this._ctx.fill();
            this._ctx.globalCompositeOperation = 'color';
            this._ctx.globalAlpha = this._settings.eyeIntensity;
        };
        drawIris(LEFT_IRIS);
        drawIris(RIGHT_IRIS);
        this._ctx.restore();
    },

    _drawMakeup(lms, w, h) {
        if (this._settings.makeupIntensity === 0) return;
        this._ctx.save();
        this._ctx.fillStyle = this._settings.makeupColor;
        this._ctx.globalCompositeOperation = 'multiply';
        this._ctx.filter = `blur(${Math.max(4, w * 0.015)}px)`;
        this._ctx.globalAlpha = this._settings.makeupIntensity * 0.7;

        const drawPoly = (indices) => {
            this._ctx.beginPath();
            indices.forEach((idx, i) => {
                i === 0
                    ? this._ctx.moveTo(lms[idx].x * w, lms[idx].y * h)
                    : this._ctx.lineTo(lms[idx].x * w, lms[idx].y * h);
            });
            this._ctx.fill();
        };
        drawPoly(LEFT_EYE_TOP);
        drawPoly(RIGHT_EYE_TOP);
        this._ctx.restore();
    },

    // ── Sauvegarde ──────────────────────────────────────────────────────
    async _save() {
        const saveBtn = this._modal?.querySelector('.fe-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Enregistrement…'; }

        this._canvas.toBlob(async (blob) => {
            if (!blob) {
                Toast.show('Impossible de capturer le canvas', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer'; }
                return;
            }

            const file = new File([blob], `retouch_${Date.now()}.jpg`, { type: 'image/jpeg' });
            this._close();
            Toast.show('⬆️ Envoi du retouch vers Google Photos…', 'info', 3000);

            try {
                await Gallery.uploadImages([file], {
                    onFileComplete: () => Toast.show('✅ Retouch enregistré !', 'success', 3000),
                    onFileError: () => Toast.show('❌ Échec de l\'envoi vers Google Photos', 'error'),
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
