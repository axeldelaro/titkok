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

    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    return modal;
}
