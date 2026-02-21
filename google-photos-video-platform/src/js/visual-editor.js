/**
 * Visual Editor — Global CSS-based photo/video enhancement panel
 * Applies filters across the entire feed in real-time
 * No image saving — purely visual overlay
 */

const SLIDERS = [
    { key: 'brightness', label: '☀️ Luminosité', min: 0.3, max: 2, step: 0.05, default: 1, unit: '' },
    { key: 'contrast', label: '◐ Contraste', min: 0.3, max: 2.5, step: 0.05, default: 1, unit: '' },
    { key: 'saturate', label: '🎨 Saturation', min: 0, max: 3, step: 0.05, default: 1, unit: '' },
    { key: 'hueRotate', label: '🌈 Teinte (Hue)', min: 0, max: 360, step: 1, default: 0, unit: 'deg' },
    { key: 'sepia', label: '📜 Sépia', min: 0, max: 1, step: 0.05, default: 0, unit: '' },
    { key: 'invert', label: '🔄 Inversion', min: 0, max: 1, step: 0.05, default: 0, unit: '' },
    { key: 'blur', label: '💧 Flou', min: 0, max: 10, step: 0.5, default: 0, unit: 'px' },
    { key: 'grayscale', label: '⬛ Noir & Blanc', min: 0, max: 1, step: 0.05, default: 0, unit: '' },
    { key: 'opacity', label: '👁️ Opacité', min: 0.1, max: 1, step: 0.05, default: 1, unit: '' },
    { key: 'warmth', label: '🔥 Chaleur', min: -30, max: 30, step: 1, default: 0, unit: 'deg' },  // custom: hue offset
    { key: 'lipSize', label: '💋 Lips Size', min: 0, max: 2, step: 0.1, default: 0, unit: 'px' },  // drop-shadow trick
    { key: 'glow', label: '✨ Glow', min: 0, max: 20, step: 1, default: 0, unit: 'px' },
];

const PRESETS = [
    { name: '🧹 Reset', values: {} },
    { name: '🌅 Warm', values: { brightness: 1.1, saturate: 1.3, sepia: 0.2, warmth: 15 } },
    { name: '❄️ Cold', values: { brightness: 1.05, saturate: 0.9, warmth: -20, contrast: 1.1 } },
    { name: '🎞️ Vintage', values: { sepia: 0.5, contrast: 1.2, brightness: 0.9, saturate: 0.7 } },
    { name: '💜 Purple', values: { hueRotate: 270, saturate: 1.3, contrast: 1.1 } },
    { name: '🖤 Dark', values: { brightness: 0.6, contrast: 1.6, saturate: 1.2 } },
    { name: '🌸 Blush', values: { hueRotate: 340, saturate: 1.5, brightness: 1.1, sepia: 0.1 } },
    { name: '🔮 Neon', values: { saturate: 2.5, contrast: 1.4, brightness: 1.2 } },
    { name: '⚪ Fade', values: { contrast: 0.7, brightness: 1.3, saturate: 0.5 } },
    { name: '🌙 Night', values: { brightness: 0.5, contrast: 1.5, saturate: 0.4, hueRotate: 220 } },
];

const VisualEditor = {
    _panel: null,
    _values: {},
    _visible: false,

    init() {
        // Load saved values
        try {
            const saved = localStorage.getItem('visualEditor');
            if (saved) this._values = JSON.parse(saved);
        } catch (e) { /* ignore */ }
    },

    toggle() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
    },

    show() {
        if (this._panel) this._panel.remove();
        this._visible = true;

        const panel = document.createElement('div');
        panel.className = 'visual-editor-panel';
        panel.innerHTML = `
            <div class="ve-header">
                <span>🎨 Visual Editor</span>
                <button class="ve-close">✕</button>
            </div>
            <div class="ve-presets"></div>
            <div class="ve-sliders"></div>
        `;

        // Close button
        panel.querySelector('.ve-close').onclick = () => this.hide();

        // Presets
        const presetsContainer = panel.querySelector('.ve-presets');
        PRESETS.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 've-preset-btn';
            btn.textContent = preset.name;
            btn.onclick = () => {
                // Reset all to defaults, then apply preset
                this._values = {};
                Object.entries(preset.values).forEach(([k, v]) => {
                    this._values[k] = v;
                });
                this._save();
                this._applyFilters();
                this._updateSliders(panel);
            };
            presetsContainer.appendChild(btn);
        });

        // Sliders
        const slidersContainer = panel.querySelector('.ve-sliders');
        SLIDERS.forEach(s => {
            const val = this._values[s.key] ?? s.default;
            const row = document.createElement('div');
            row.className = 've-slider-row';
            row.innerHTML = `
                <label class="ve-label">${s.label}</label>
                <input type="range" class="ve-range" data-key="${s.key}"
                    min="${s.min}" max="${s.max}" step="${s.step}" value="${val}" />
                <span class="ve-value" data-key="${s.key}">${val}</span>
            `;
            const range = row.querySelector('input');
            const display = row.querySelector('.ve-value');
            range.oninput = () => {
                const v = parseFloat(range.value);
                this._values[s.key] = v;
                display.textContent = v;
                this._applyFilters();
                this._save();
            };
            slidersContainer.appendChild(row);
        });

        // Prevent scroll on panel touch
        panel.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

        document.body.appendChild(panel);
        this._panel = panel;
        this._applyFilters();
    },

    hide() {
        this._visible = false;
        if (this._panel) {
            this._panel.remove();
            this._panel = null;
        }
    },

    _updateSliders(panel) {
        SLIDERS.forEach(s => {
            const range = panel.querySelector(`input[data-key="${s.key}"]`);
            const display = panel.querySelector(`span[data-key="${s.key}"]`);
            const val = this._values[s.key] ?? s.default;
            if (range) range.value = val;
            if (display) display.textContent = val;
        });
    },

    _buildFilterString() {
        const v = this._values;
        const parts = [];

        const get = (key) => {
            const s = SLIDERS.find(sl => sl.key === key);
            return v[key] ?? s.default;
        };

        if (get('brightness') !== 1) parts.push(`brightness(${get('brightness')})`);
        if (get('contrast') !== 1) parts.push(`contrast(${get('contrast')})`);
        if (get('saturate') !== 1) parts.push(`saturate(${get('saturate')})`);
        if (get('sepia') !== 0) parts.push(`sepia(${get('sepia')})`);
        if (get('grayscale') !== 0) parts.push(`grayscale(${get('grayscale')})`);
        if (get('invert') !== 0) parts.push(`invert(${get('invert')})`);
        if (get('blur') !== 0) parts.push(`blur(${get('blur')}px)`);

        // Hue = hueRotate + warmth offset
        const totalHue = get('hueRotate') + get('warmth');
        if (totalHue !== 0) parts.push(`hue-rotate(${totalHue}deg)`);

        // Drop-shadow glow
        if (get('glow') > 0) parts.push(`drop-shadow(0 0 ${get('glow')}px rgba(255,255,255,0.6))`);

        // Lip-size uses drop-shadow as a crude "enlarging" effect on reds
        if (get('lipSize') > 0) parts.push(`drop-shadow(0 0 ${get('lipSize')}px rgba(200,50,80,0.5))`);

        return parts.length > 0 ? parts.join(' ') : 'none';
    },

    _applyFilters() {
        const filterStr = this._buildFilterString();
        const opacity = this._values.opacity ?? 1;

        // Apply to all feed containers and gallery containers
        document.querySelectorAll('.video-feed, .gallery-grid, .gallery-img-container, .feed-player-container').forEach(el => {
            el.style.filter = filterStr;
            el.style.opacity = opacity;
        });
    },

    _save() {
        try {
            localStorage.setItem('visualEditor', JSON.stringify(this._values));
        } catch (e) { /* ignore */ }
    },

    // Called when new content is rendered to reapply filters
    reapply() {
        if (Object.keys(this._values).length > 0) {
            this._applyFilters();
        }
    }
};

export default VisualEditor;
