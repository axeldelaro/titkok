export const Toast = {
    show: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `toast toast-${type}`;

        Object.assign(toast.style, {
            position: 'fixed', bottom: '20px', right: '20px',
            padding: '10px 20px', borderRadius: '4px',
            background: type === 'error' ? 'red' : 'var(--primary-color)',
            color: 'white', zIndex: '3000',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            opacity: '0', transform: 'translateY(10px)', transition: '0.3s'
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

export default Toast;
