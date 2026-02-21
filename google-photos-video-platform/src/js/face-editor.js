import Gallery from './gallery.js';
import { Toast } from '../components/toast.js';
import Store from './store.js';

let FaceMesh;
let faceMeshInstance;

// MediaPipe 468 landmarks are complex, but typical indices:
// Lips outer: 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40
// Left Iris: 474, 475, 476, 477 (center 468)
// Right Iris: 469, 470, 471, 472 (center 473)
// Left Eyeshadow area: above 33, 7, 163, 144, 145, 153, 154, 155, 133
// Right Eyeshadow area: above 362, 382, 381, 380, 374, 373, 390, 249, 263

const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LEFT_IRIS = [474, 475, 476, 477];
const RIGHT_IRIS = [469, 470, 471, 472];
const LEFT_EYE_TOP = [130, 247, 30, 29, 27, 28, 56, 190, 244, 112, 26, 22, 23, 24, 110, 25]; // approx eyelid/shadow area
const RIGHT_EYE_TOP = [359, 467, 260, 259, 257, 258, 286, 414, 464, 341, 256, 252, 253, 254, 339, 255];

const FaceEditor = {
    _modal: null,
    _canvas: null,
    _ctx: null,
    _imgEl: null,
    _originalImageSrc: null,
    _originalImageObj: null,
    _cachedLandmarks: null,

    _settings: {
        lipColor: '#ff0000',
        lipIntensity: 0.0,
        lipThickness: 1.0,  // Scale
        eyeColor: '#00ff00',
        eyeIntensity: 0.0,
        makeupColor: '#000000',
        makeupIntensity: 0.0,
    },

    async init() {
        if (!FaceMesh) {
            Toast.show('Loading Face AI Models...', 'info', 3000);
            await this._loadScripts();
            FaceMesh = window.FaceMesh;

            faceMeshInstance = new FaceMesh({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });

            faceMeshInstance.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true, // Needed for irises
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            faceMeshInstance.onResults(this._onResults.bind(this));
        }
    },

    async _loadScripts() {
        return new Promise((resolve) => {
            const script1 = document.createElement('script');
            script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';

            script1.onload = () => {
                script2.onload = resolve;
                document.body.appendChild(script2);
            };
            document.body.appendChild(script1);
        });
    },

    async open(imageObj) {
        this._originalImageObj = imageObj;
        this._originalImageSrc = Gallery.getFullURL(imageObj);
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
        document.getElementById('fe-loading').style.display = 'flex';
        await this.init();

        // Use a 1080px version to be faster
        this._originalImageSrc = Gallery.getImageURL(imageObj, 1080);

        // Load image to canvas
        this._imgEl = new Image();
        this._imgEl.crossOrigin = "anonymous";

        this._imgEl.onload = async () => {
            this._canvas.width = this._imgEl.width;
            this._canvas.height = this._imgEl.height;
            this._ctx.drawImage(this._imgEl, 0, 0);

            // Send to MediaPipe
            try {
                await faceMeshInstance.send({ image: this._imgEl });
            } catch (err) {
                console.error('FaceMesh error:', err);
                Toast.show('Could not detect face. Try another image.', 'error');
                document.getElementById('fe-loading').style.display = 'none';
            }
        };

        this._imgEl.onerror = () => {
            console.error("Direct Image load failed, routing through proxy API...");

            // For Google Photos URLs on static hosts like GitHub Pages,
            // we use a public CORS proxy to load the image as a blob
            // and bypass the strict origin canvas tainting.
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(this._originalImageSrc)}`;

            fetch(proxyUrl)
                .then(res => {
                    if (!res.ok) throw new Error('Proxy failed');
                    return res.blob();
                })
                .then(blob => {
                    this._imgEl.onerror = null; // prevent infinite loop
                    this._imgEl.src = URL.createObjectURL(blob);
                })
                .catch(err => {
                    console.error("Proxy fetch failed", err);
                    Toast.show('Error loading image for editing.', 'error');
                    document.getElementById('fe-loading').style.display = 'none';
                });
        };

        this._imgEl.src = this._originalImageSrc;
    },

    _buildUI() {
        if (this._modal) this._modal.remove();

        this._modal = document.createElement('div');
        this._modal.className = 'face-editor-modal';
        this._modal.innerHTML = `
            <div class="fe-header">
                <button class="fe-close-btn">✕</button>
                <h3>🪄 AI Retouch</h3>
                <button class="fe-save-btn">Save</button>
            </div>
            
            <div class="fe-canvas-container">
                <canvas id="fe-canvas"></canvas>
                <div id="fe-loading" class="fe-loading-overlay" style="display:none;">
                    <div class="fe-spinner"></div>
                    <p>Analyzing Face...</p>
                </div>
            </div>

            <div class="fe-toolbar">
                <div class="fe-tabs">
                    <button class="fe-tab active" data-target="lips">Lips 💋</button>
                    <button class="fe-tab" data-target="eyes">Eyes 👁️</button>
                    <button class="fe-tab" data-target="makeup">Makeup 💄</button>
                </div>

                <div class="fe-panels">
                    <!-- Lips Panel -->
                    <div class="fe-panel active" id="panel-lips">
                        <div class="fe-control">
                            <label>Thickness <span id="val-thickness">1.0</span></label>
                            <input type="range" id="sl-lip-thickness" min="0.8" max="1.5" step="0.05" value="1.0">
                        </div>
                        <div class="fe-control">
                            <label>Color Intensity <span id="val-lip-int">0%</span></label>
                            <input type="range" id="sl-lip-intensity" min="0" max="1" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Tint</label>
                            <input type="color" id="cl-lip-color" value="#ff0055">
                        </div>
                    </div>

                    <!-- Eyes Panel -->
                    <div class="fe-panel" id="panel-eyes">
                        <div class="fe-control">
                            <label>Color Intensity <span id="val-eye-int">0%</span></label>
                            <input type="range" id="sl-eye-intensity" min="0" max="1" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Tint</label>
                            <input type="color" id="cl-eye-color" value="#00aaff">
                        </div>
                    </div>

                    <!-- Makeup Panel -->
                    <div class="fe-panel" id="panel-makeup">
                        <div class="fe-control">
                            <label>Eyeshadow <span id="val-makeup-int">0%</span></label>
                            <input type="range" id="sl-makeup-intensity" min="0" max="0.8" step="0.05" value="0">
                        </div>
                        <div class="fe-control">
                            <label>Color</label>
                            <input type="color" id="cl-makeup-color" value="#111111">
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .face-editor-modal { position: fixed; inset: 0; background: #000; z-index: 9999; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); padding-top: env(safe-area-inset-top); }
                .fe-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: rgba(20,20,20,0.9); border-bottom: 1px solid #333; }
                .fe-header h3 { margin: 0; font-size: 1.1rem; }
                .fe-close-btn, .fe-save-btn { background: none; border: none; color: #fff; font-size: 1rem; cursor: pointer; padding: 10px; margin: -10px; }
                .fe-save-btn { color: var(--primary-color, #7c3aed); font-weight: 600; }
                
                .fe-canvas-container { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; background: #111; }
                #fe-canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
                
                .fe-loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; justify-content: center; align-items: center; }
                .fe-spinner { width: 40px; height: 40px; border: 4px solid #333; border-top-color: #7c3aed; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px; }
                @keyframes spin { 100% { transform: rotate(360deg); } }

                .fe-toolbar { background: #1a1a1a; padding: 15px; padding-bottom: max(15px, env(safe-area-inset-bottom)); border-top: 1px solid #333; flex-shrink: 0; }
                .fe-tabs { display: flex; gap: 10px; margin-bottom: 15px; overflow-x: auto; padding-bottom: 5px; -webkit-overflow-scrolling: touch; }
                .fe-tab { background: #333; color: #fff; border: 1px solid #444; border-radius: 20px; padding: 8px 16px; white-space: nowrap; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
                .fe-tab.active { background: #7c3aed; border-color: #7c3aed; }
                
                .fe-panels { min-height: 140px; }
                .fe-panel { display: none; flex-direction: column; gap: 15px; }
                .fe-panel.active { display: flex; }
                
                .fe-control { display: flex; align-items: center; justify-content: space-between; }
                .fe-control label { font-size: 0.9rem; color: #aaa; flex: 1; display:flex; justify-content: space-between; margin-right: 15px; }
                .fe-control input[type="range"] { flex: 2; accent-color: #7c3aed; height: 24px; margin: 0; }
                .fe-control input[type="color"] { width: 44px; height: 36px; padding: 0; border: none; border-radius: 5px; cursor: pointer; background: none; }
            </style>
        `;

        document.body.appendChild(this._modal);
        this._canvas = document.getElementById('fe-canvas');
        this._ctx = this._canvas.getContext('2d');

        // Close
        this._modal.querySelector('.fe-close-btn').onclick = () => this._close();

        // Save
        this._modal.querySelector('.fe-save-btn').onclick = () => this._save();

        // Tabs
        this._modal.querySelectorAll('.fe-tab').forEach(btn => {
            btn.onclick = () => {
                this._modal.querySelectorAll('.fe-tab').forEach(b => b.classList.remove('active'));
                this._modal.querySelectorAll('.fe-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('panel-' + btn.dataset.target).classList.add('active');
            };
        });

        // Listeners for sliders
        const bindSlider = (id, key, valId, isPercent) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.oninput = () => {
                let v = parseFloat(el.value);
                if (el.type === 'color') v = el.value;
                this._settings[key] = v;

                if (valId && el.type !== 'color') {
                    document.getElementById(valId).textContent = isPercent ? Math.round(v * 100) + '%' : v.toFixed(2);
                }
                this._render();
            };
        };

        bindSlider('sl-lip-thickness', 'lipThickness', 'val-thickness', false);
        bindSlider('sl-lip-intensity', 'lipIntensity', 'val-lip-int', true);
        bindSlider('cl-lip-color', 'lipColor');

        bindSlider('sl-eye-intensity', 'eyeIntensity', 'val-eye-int', true);
        bindSlider('cl-eye-color', 'eyeColor');

        bindSlider('sl-makeup-intensity', 'makeupIntensity', 'val-makeup-int', true);
        bindSlider('cl-makeup-color', 'makeupColor');
    },

    _close() {
        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
    },

    _onResults(results) {
        document.getElementById('fe-loading').style.display = 'none';
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this._cachedLandmarks = results.multiFaceLandmarks[0];
            Toast.show('Face detected! You can now apply edits.', 'success', 2000);
            this._render();
        } else {
            Toast.show('No face detected', 'error');
        }
    },

    // ----------------------------------------------------
    // RENDERING LOGIC
    // ----------------------------------------------------
    _render() {
        if (!this._imgEl || !this._ctx) return;

        const w = this._canvas.width;
        const h = this._canvas.height;

        // 1. Draw Original Image
        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.filter = 'none';
        this._ctx.drawImage(this._imgEl, 0, 0, w, h);

        if (!this._cachedLandmarks) return;
        const lms = this._cachedLandmarks;

        // 2. Lips (Plump & Color)
        this._drawLips(lms, w, h);

        // 3. Eyes (Color Iris)
        this._drawIrises(lms, w, h);

        // 4. Eyeshadow
        this._drawMakeup(lms, w, h);
    },

    _getCenter(indices, lms, w, h) {
        let cx = 0, cy = 0;
        indices.forEach(i => {
            cx += lms[i].x * w;
            cy += lms[i].y * h;
        });
        return { x: cx / indices.length, y: cy / indices.length };
    },

    _drawLips(lms, w, h) {
        const t = this._settings.lipThickness;
        const intensity = this._settings.lipIntensity;

        // If nothing changed, skip
        if (t === 1.0 && intensity === 0) return;

        const center = this._getCenter(LIPS_OUTER, lms, w, h);

        this._ctx.save();

        // If thickness changed, scale the underlying image part
        if (t !== 1.0) {
            // Very basic magnification effect
            // Clip to lips
            this._ctx.beginPath();
            LIPS_OUTER.forEach((idx, i) => {
                const pt = lms[idx];
                const x = pt.x * w;
                const y = pt.y * h;
                // scale outward from center
                const sx = center.x + (x - center.x) * t;
                const sy = center.y + (y - center.y) * t;
                if (i === 0) this._ctx.moveTo(sx, sy);
                else this._ctx.lineTo(sx, sy);
            });
            this._ctx.closePath();

            // To do geometric distortion elegantly in 2D canvas without WebGL is hard.
            // A simple approximation: draw a clipped, scaled version of the image 
            // over the lips. It's a bit hacky but works for a prototype.
            this._ctx.clip();
            this._ctx.translate(center.x, center.y);
            this._ctx.scale(t, t);
            this._ctx.translate(-center.x, -center.y);
            this._ctx.drawImage(this._imgEl, 0, 0, w, h);
            this._ctx.restore();
            this._ctx.save();
        }

        // Apply Color Tint
        if (intensity > 0) {
            this._ctx.beginPath();
            LIPS_OUTER.forEach((idx, i) => {
                const pt = lms[idx];
                const x = center.x + (pt.x * w - center.x) * (t); // use scaled bounds if plumped
                const y = center.y + (pt.y * h - center.y) * (t);
                if (i === 0) this._ctx.moveTo(x, y);
                else this._ctx.lineTo(x, y);
            });
            this._ctx.closePath();

            // Soft edges
            this._ctx.filter = 'blur(4px)';
            this._ctx.fillStyle = this._settings.lipColor;
            this._ctx.globalAlpha = intensity * 0.5; // 'multiply' or 'overlay' works better but alpha is safer
            this._ctx.globalCompositeOperation = 'overlay';
            this._ctx.fill();

            // Re-fill with color for stronger tint
            this._ctx.globalCompositeOperation = 'color';
            this._ctx.globalAlpha = intensity * 0.8;
            this._ctx.fill();
        }

        this._ctx.restore();
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
            // distance from center to one edge approx radius
            const p1 = lms[indices[0]];
            const r = Math.hypot(p1.x * w - center.x, p1.y * h - center.y) * 1.2;

            this._ctx.beginPath();
            this._ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
            this._ctx.fill();

            // overlay slightly
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

        // Huge blur for eyeshadow
        const blurAmt = Math.max(4, w * 0.015);
        this._ctx.filter = `blur(${blurAmt}px)`;
        this._ctx.globalAlpha = this._settings.makeupIntensity * 0.7;

        const drawPoly = (indices) => {
            this._ctx.beginPath();
            indices.forEach((idx, i) => {
                const pt = lms[idx];
                if (i === 0) this._ctx.moveTo(pt.x * w, pt.y * h);
                else this._ctx.lineTo(pt.x * w, pt.y * h);
            });
            this._ctx.fill();
        };

        drawPoly(LEFT_EYE_TOP);
        drawPoly(RIGHT_EYE_TOP);

        this._ctx.restore();
    },

    async _save() {
        Toast.show('Saving edited image...', 'info');

        this._canvas.toBlob(async (blob) => {
            if (!blob) {
                Toast.show('Failed to capture canvas', 'error');
                return;
            }

            const fileName = `edited_retouch_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });

            this._close(); // Close modal immediately

            // Upload
            Gallery.addLocalImages([file]);
            const contentEl = document.getElementById('content');

            // Force re-render if on gallery
            if (window.location.hash === '#/gallery' && contentEl) {
                // Not ideal coupling, but works for immediate feedback
                // Actually the Gallery module itself or UI module handles the re-render.
                // Let's just emulate the upload flow.
            }

            await Gallery.uploadImages([file], {
                onFileStart: () => Toast.show('Uploading Retouch...', 'info'),
                onFileComplete: () => Toast.show('Retouch Saved & Uploaded! ✅', 'success'),
                onFileError: () => Toast.show('Failed to save retouch to Google Photos', 'error'),
            });

            // Refresh Gallery
            Gallery.removeLocalImages();
            await Gallery.fetchAllImages();

        }, 'image/jpeg', 0.95);
    }
};

export default FaceEditor;
