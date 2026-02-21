// Improved Toast System (#34) — Stackable, typed icons, progress bar
let toastContainer = null;

function ensureContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column-reverse;gap:8px;max-width:360px;width:100%;pointer-events:none;';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
};

const COLORS = {
    success: 'rgba(16, 185, 129, 0.95)',
    error: 'rgba(239, 68, 68, 0.95)',
    warning: 'rgba(245, 158, 11, 0.95)',
    info: 'rgba(99, 102, 241, 0.95)'
};

export const Toast = {
    show: (message, type = 'info', duration = 3500) => {
        const container = ensureContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            display:flex;align-items:center;gap:10px;
            padding:12px 18px;border-radius:10px;
            background:${COLORS[type] || COLORS.info};
            color:white;font-size:0.9rem;font-weight:500;
            box-shadow:0 8px 24px rgba(0,0,0,0.35);
            opacity:0;transform:translateX(100%);
            transition:all 0.35s cubic-bezier(0.21,1.02,0.73,1);
            pointer-events:auto;cursor:pointer;position:relative;
            overflow:hidden;backdrop-filter:blur(10px);
        `;

        toast.innerHTML = `
            <span style="font-size:1.2rem;flex-shrink:0;">${ICONS[type] || ICONS.info}</span>
            <span style="flex:1;">${message}</span>
            <span class="toast-close" style="opacity:0.6;font-size:1.1rem;cursor:pointer;">×</span>
            <div class="toast-progress" style="position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,0.4);width:100%;border-radius:0 0 10px 10px;transition:width linear;"></div>
        `;

        container.appendChild(toast);

        // Slide in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Progress bar countdown
        const progressBar = toast.querySelector('.toast-progress');
        requestAnimationFrame(() => {
            progressBar.style.transitionDuration = `${duration}ms`;
            progressBar.style.width = '0%';
        });

        // Close handler
        const close = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 350);
        };

        toast.querySelector('.toast-close').onclick = close;
        toast.onclick = close;

        // Auto-dismiss
        setTimeout(close, duration);
    }
};

export default Toast;
