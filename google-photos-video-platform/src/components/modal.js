export default function Modal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="close-btn">×</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
        <style>
            .modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.7);
                display: flex; align-items: center; justify-content: center;
                z-index: 2000; opacity: 0; transition: opacity 0.3s;
            }
            .modal-content {
                background: var(--surface-color); padding: 1.5rem; border-radius: 8px;
                width: 90%; max-width: 500px; transform: translateY(20px); transition: transform 0.3s;
            }
            .modal-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
            .modal-overlay.open { opacity: 1; pointer-events: auto; }
            .modal-overlay.open .modal-content { transform: translateY(0); }
        </style>
    `;

    // Animation trigger
    requestAnimationFrame(() => modal.classList.add('open'));

    const close = () => {
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.close-btn').onclick = close;
    modal.onclick = (e) => {
        if (e.target === modal) close();
    };

    return modal;
}
