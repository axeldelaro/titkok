// Utility functions

// Generate a random string for state and code verifier
export const generateRandomString = (length) => {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => ('0' + dec.toString(16)).slice(-2)).join('');
};

// Calculate SHA-256 challenge for PKCE
export const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return hash;
};

// Base64URL encode
export const base64UrlEncode = (str) => {
    // Convert ArrayBuffer to Base64
    let base64 = '';
    const bytes = new Uint8Array(str);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        base64 += String.fromCharCode(bytes[i]);
    }
    return btoa(base64)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

// Debounce function ensuring a function is not called too frequently
export const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// Format duration from milliseconds to MM:SS or HH:MM:SS
export const formatDuration = (ms) => {
    if (!ms) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
};
