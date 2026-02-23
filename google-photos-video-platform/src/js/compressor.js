/**
 * Compressor — Client-side image compression using Canvas
 * Supports 3 quality levels: HQ / Normal / Light
 * Only applies to images (video files are left untouched)
 */

export const QUALITY_PRESETS = {
    HQ: { label: '🔵 HQ', maxDim: 2400, quality: 0.92 },
    Normal: { label: '🟢 Normal', maxDim: 1600, quality: 0.80 },
    Light: { label: '🟡 Light', maxDim: 900, quality: 0.65 },
};

let _selectedQuality = localStorage.getItem('uploadQuality') || 'HQ';

export function getQuality() { return _selectedQuality; }
export function setQuality(q) {
    _selectedQuality = q;
    localStorage.setItem('uploadQuality', q);
}

/**
 * Compress a single image File using Canvas.
 * Returns a new File with the same name, compressed.
 * Non-image files are returned as-is.
 */
export async function compressImage(file) {
    if (!file.type.startsWith('image/')) return file; // skip videos / other
    const preset = QUALITY_PRESETS[_selectedQuality] || QUALITY_PRESETS.HQ;

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;
            const ratio = width / height;

            // Scale down if needed
            if (width > preset.maxDim || height > preset.maxDim) {
                if (width > height) {
                    width = preset.maxDim;
                    height = Math.round(preset.maxDim / ratio);
                } else {
                    height = preset.maxDim;
                    width = Math.round(preset.maxDim * ratio);
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Determine output MIME (keep jpeg for jpegs, use webp otherwise for better compression)
            const outMime = file.type === 'image/jpeg' || file.type === 'image/jpg'
                ? 'image/jpeg'
                : 'image/webp';

            canvas.toBlob((blob) => {
                if (!blob) { resolve(file); return; } // fallback: no change
                // Keep extension compatible
                const ext = outMime === 'image/jpeg' ? '.jpg' : '.webp';
                const baseName = file.name.replace(/\.[^.]+$/, '');
                const newFile = new File([blob], baseName + ext, {
                    type: outMime,
                    lastModified: file.lastModified,
                });
                resolve(newFile);
            }, outMime, preset.quality);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // fallback if image load fails
        };

        img.src = url;
    });
}

/**
 * Compress an array of Files. Returns array of (possibly compressed) Files.
 * Calls onProgress(done, total, originalSize, newSize) after each file.
 */
export async function compressAll(files, onProgress) {
    const result = [];
    let totalOriginal = 0;
    let totalNew = 0;

    for (let i = 0; i < files.length; i++) {
        const original = files[i];
        totalOriginal += original.size;

        const compressed = await compressImage(original);
        totalNew += compressed.size;
        result.push(compressed);

        if (onProgress) onProgress(i + 1, files.length, totalOriginal, totalNew);
    }

    return result;
}

/**
 * Build a quality-selector UI element (pill buttons).
 * Pass an onChange callback to react to changes.
 */
export function buildQualitySelector(onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'upload-quality-selector';

    const label = document.createElement('span');
    label.className = 'uq-label';
    label.textContent = 'Compression :';
    wrap.appendChild(label);

    Object.entries(QUALITY_PRESETS).forEach(([key, preset]) => {
        const btn = document.createElement('button');
        btn.className = 'uq-btn' + (_selectedQuality === key ? ' active' : '');
        btn.dataset.key = key;
        btn.textContent = preset.label;
        btn.type = 'button';
        btn.onclick = () => {
            setQuality(key);
            wrap.querySelectorAll('.uq-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (onChange) onChange(key);
        };
        wrap.appendChild(btn);
    });

    return wrap;
}
