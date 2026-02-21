import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';

let FaceMesh;
let faceMeshInstance;

// MediaPipe 468 landmarks:
// Lips outer: 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40
// Left Iris: 474, 475, 476, 477
// Right Iris: 469, 470, 471, 472
// Left Eyeshadow area: above 33, 7, 163, 144, 145, 153, 154, 155, 133
// Right Eyeshadow area: above 362, 382, 381, 380, 374, 373, 390, 249, 263

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
    _originalImageSrc: null,
    _originalImageObj: null,
    _cachedLandmarks: null,
    _initializing: false,   // FIX #1: empêche la double initialisation

    _settings: {
        lipColor: '#ff0055',
        lipIntensity: 0.0,
        lipThickness: 1.0,
        eyeColor: '#00aaff',
        eyeIntensity: 0.0,
        makeupColor: '#111111',
        makeupIntensity: 0.0,
    },

    // ── Init MediaPipe (idempotent & thread-safe) ──────────────────────────
    async init() {
        if (FaceMesh) return;                    // déjà prêt
        if (this._initializing) return;          // FIX #1: déjà en cours
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
                refineLandmarks: true,   // nécessaire pour les iris
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            faceMeshInstance.onResults(this._onResults.bind(this));
        } finally {
            this._initializing = false;
        }
    },

    // FIX #1: chargement parallèle des deux scripts MediaPipe
    async _loadScripts() {
        const load = (src) => new Promise((resolve, reject) => {
            // Évite de recharger un script déjà présent
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(`Impossible de charger : ${src}`));
            document.body.appendChild(s);
        });

        await Promise.all([
            load('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
            load('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'),
        ]);
    },

    // ── Ouverture du modal ─────────────────────────────────────────────────
    async open(imageObj) {
        // FIX #4: les images locales (blob) ne peuvent pas être analysées par MediaPipe
        if (imageObj._isLocal) {
            Toast.show('AI Retouch indisponible pour les images locales (upload d\'abord)', 'error', 3500);
            return;
        }

        this._originalImageObj = imageObj;
        this._cachedLandmarks = null;

        // Reset settings
        this._settings = {
            lipColor: '#ff0055',
            lipIntensity: 0.0,
            lipThickness: 1.0,
            eyeColor: '#00aaff',
            eyeIntensity: 0.0,
            makeupColor: '#111111',
            makeupIntensity: 0.0,
        };

        this._buildUI();
        this._showLoading(true);

        await this.init();

        // Résolution 1080px pour la vitesse
        this._originalImageSrc = Gallery.getImageURL(imageObj, 1080);

        // Charge l'image dans le canvas
        this._imgEl = new Image();
        this._imgEl.crossOrigin = 'anonymous';

        this._imgEl.onload = async () => {
            if (!this._modal) return;  // FIX #2: modal fermé pendant le chargement
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
            console.warn('[FaceEditor] Chargement direct échoué, tentative via proxy…');

            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(this._originalImageSrc)}`;
            fetch(proxyUrl)
                .then(res => {
                    if (!res.ok) throw new Error('Proxy failed');
                    return res.blob();
                })
                .then(blob => {
                    if (!this._modal) return;   // FIX #2: modal fermé entre-temps
                    this._imgEl.onerror = null; // évite la boucle infinie
                    this._imgEl.src = URL.createObjectURL(blob);
                })
                .catch(err => {
                    console.error('[FaceEditor] Proxy fetch failed', err);
                    Toast.show('Erreur lors du chargement de l\'image.', 'error');
                    this._showLoading(false);
                });
        };

        this._imgEl.src = this._originalImageSrc;
    },

    // ── Construction du modal ──────────────────────────────────────────────
    _buildUI() {
        if (this._modal) this._modal.remove();

        this._modal = document.createElement('div');
        this._modal.className = 'face-editor-modal';
        // FIX #6: plus de <style> inline — les styles sont dans layout.css
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
                    <!-- Lips Panel -->
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

                    <!-- Eyes Panel -->
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

                    <!-- Makeup Panel -->
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

        // Fermeture
        this._modal.querySelector('.fe-close-btn').onclick = () => this._close();

        // Enregistrement
        this._modal.querySelector('.fe-save-btn').onclick = () => this._save();

        // Réinitialisation
        this._modal.querySelector('.fe-reset-btn').onclick = () => {
            this._settings = {
                lipColor: '#ff0055', lipIntensity: 0.0, lipThickness: 1.0,
                eyeColor: '#00aaff', eyeIntensity: 0.0,
                makeupColor: '#111111', makeupIntensity: 0.0,
            };
            // Réinitialiser les contrôles visuellement
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

        // Onglets
        this._modal.querySelectorAll('.fe-tab').forEach(btn => {
            btn.onclick = () => {
                this._modal.querySelectorAll('.fe-tab').forEach(b => b.classList.remove('active'));
                this._modal.querySelectorAll('.fe-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                this._modal.querySelector('#panel-' + btn.dataset.target).classList.add('active');
            };
        });

        // Liaisons des sliders
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

    // ── Helpers DOM sécurisés ──────────────────────────────────────────────

    // FIX #2: utilise this._modal pour toutes les requêtes DOM internes
    _showLoading(visible) {
        const el = this._modal?.querySelector('#fe-loading');
        if (el) el.style.display = visible ? 'flex' : 'none';
    },

    _close() {
        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
    },

    // ── Callback MediaPipe ────────────────────────────────────────────────
    _onResults(results) {
        this._showLoading(false);   // FIX #2: sécurisé
        if (!this._modal) return;  // FIX #2: modal fermé pendant l'analyse

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this._cachedLandmarks = results.multiFaceLandmarks[0];
            Toast.show('Visage détecté ! Applique tes retouches 🎨', 'success', 2000);
            this._render();
        } else {
            Toast.show('Aucun visage détecté', 'error');
        }
    },

    // ── Rendu canvas ──────────────────────────────────────────────────────
    _render() {
        if (!this._imgEl || !this._ctx || !this._modal) return;

        const { width: w, height: h } = this._canvas;

        // 1. Image originale (reset état canvas)
        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.globalAlpha = 1;
        this._ctx.filter = 'none';
        this._ctx.drawImage(this._imgEl, 0, 0, w, h);

        if (!this._cachedLandmarks) return;
        const lms = this._cachedLandmarks;

        // 2. Lèvres
        this._drawLips(lms, w, h);

        // 3. Iris
        this._drawIrises(lms, w, h);

        // 4. Fard à paupières
        this._drawMakeup(lms, w, h);
    },

    _getCenter(indices, lms, w, h) {
        let cx = 0, cy = 0;
        indices.forEach(i => { cx += lms[i].x * w; cy += lms[i].y * h; });
        return { x: cx / indices.length, y: cy / indices.length };
    },

    // FIX #5: un seul save/restore, filtre et alpha réinitialisés explicitement
    _drawLips(lms, w, h) {
        const t = this._settings.lipThickness;
        const intensity = this._settings.lipIntensity;
        if (t === 1.0 && intensity === 0) return;

        const center = this._getCenter(LIPS_OUTER, lms, w, h);

        // ── Épaisseur : zoom clippé sur la zone des lèvres ──
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

        // ── Couleur / teinte ──
        if (intensity > 0) {
            this._ctx.save();
            this._ctx.beginPath();
            LIPS_OUTER.forEach((idx, i) => {
                const x = center.x + (lms[idx].x * w - center.x) * t;
                const y = center.y + (lms[idx].y * h - center.y) * t;
                i === 0 ? this._ctx.moveTo(x, y) : this._ctx.lineTo(x, y);
            });
            this._ctx.closePath();

            // Passe 1 : overlay doux
            this._ctx.filter = 'blur(4px)';
            this._ctx.globalCompositeOperation = 'overlay';
            this._ctx.globalAlpha = intensity * 0.5;
            this._ctx.fillStyle = this._settings.lipColor;
            this._ctx.fill();

            // Passe 2 : teinte couleur plus marquée
            this._ctx.globalCompositeOperation = 'color';
            this._ctx.globalAlpha = intensity * 0.8;
            this._ctx.fill();

            // FIX #5: réinitialisation explicite avant restore (au cas où)
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

            // Remettre pour l'iris suivant
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
                const pt = lms[idx];
                i === 0
                    ? this._ctx.moveTo(pt.x * w, pt.y * h)
                    : this._ctx.lineTo(pt.x * w, pt.y * h);
            });
            this._ctx.fill();
        };

        drawPoly(LEFT_EYE_TOP);
        drawPoly(RIGHT_EYE_TOP);

        this._ctx.restore();
    },

    // ── Sauvegarde ─────────────────────────────────────────────────────────
    // FIX #3 : suppression de addLocalImages / removeLocalImages qui perturbaient les autres uploads
    async _save() {
        const saveBtn = this._modal?.querySelector('.fe-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Enregistrement…'; }

        this._canvas.toBlob(async (blob) => {
            if (!blob) {
                Toast.show('Impossible de capturer le canvas', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer'; }
                return;
            }

            const fileName = `retouch_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });

            this._close(); // Ferme immédiatement le modal
            Toast.show('⬆️ Envoi du retouch vers Google Photos…', 'info', 3000);

            try {
                await Gallery.uploadImages([file], {
                    onFileComplete: () => Toast.show('✅ Retouch enregistré !', 'success', 3000),
                    onFileError: () => Toast.show('❌ Échec de l\'envoi vers Google Photos', 'error'),
                });

                // Actualise la galerie après un délai (Google Photos a besoin de traiter)
                setTimeout(async () => {
                    await Gallery.fetchAllImages();
                }, 6000);

            } catch (err) {
                console.error('[FaceEditor] save error:', err);
                Toast.show('Erreur lors de l\'enregistrement', 'error');
            }
        }, 'image/jpeg', 0.95);
    },
};

export default FaceEditor;
