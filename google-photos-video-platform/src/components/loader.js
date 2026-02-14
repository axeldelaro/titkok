export default function Loader() {
    const el = document.createElement('div');
    el.className = 'loader-container';
    el.innerHTML = `
        <div class="spinner"></div>
        <style>
            .loader-container {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 2rem;
                width: 100%;
            }
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: var(--primary-color);
                animation: spin 1s ease-in-out infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    return el;
}
