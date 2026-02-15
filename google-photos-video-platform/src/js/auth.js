import Storage from './storage.js';
import { generateRandomString, sha256, base64UrlEncode } from './utils.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
// Scopes: Read-only access to media items and User Profile
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid';
const REDIRECT_URI = window.location.origin + (import.meta.env.BASE_URL || '/'); // Include base path for GitHub Pages

const Auth = {
    isAuthenticated: () => {
        const token = Storage.get('access_token', 'session');
        const expiresAt = Storage.get('expires_at', 'session');
        return token && expiresAt && new Date().getTime() < expiresAt;
    },

    getAccessToken: () => {
        if (Auth.isAuthenticated()) {
            return Storage.get('access_token', 'session');
        }
        return null; // Should trigger re-login or refresh if we had refresh token flow (PKCE usually returns Refresh Token if prompt=consent)
    },

    login: async () => {
        // PKCE Flow
        const codeVerifier = generateRandomString(64);
        const hashed = await sha256(codeVerifier);
        const codeChallenge = base64UrlEncode(hashed);

        // Store code_verifier for callback
        Storage.set('code_verifier', codeVerifier, 'session');

        // Generate State to prevent CSRF
        const state = generateRandomString(32);
        Storage.set('auth_state', state, 'session');

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', SCOPES);
        authUrl.searchParams.append('code_challenge', codeChallenge);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('access_type', 'online');
        authUrl.searchParams.append('prompt', 'consent');

        window.location.href = authUrl.toString();
    },

    handleCallback: async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error) {
            console.error('Auth error:', error);
            alert('Auth error: ' + error + ' - ' + params.get('error_description'));
            return false;
        }

        if (!code) return false;

        // Verify state
        const storedState = Storage.get('auth_state', 'session');
        if (state !== storedState) {
            console.error('State mismatch');
            alert('State mismatch: expected ' + storedState + ', got ' + state);
            return false;
        }

        const codeVerifier = Storage.get('code_verifier', 'session');
        if (!codeVerifier) {
            console.error('Code verifier missing');
            alert('Code verifier missing from session storage');
            return false;
        }

        // Exchange code for token
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: codeVerifier,
                }),
            });

            const data = await response.json();

            if (data.error) {
                alert('Token exchange error: ' + data.error + ' - ' + (data.error_description || ''));
                throw new Error(data.error_description || data.error);
            }

            // Save tokens
            Storage.set('access_token', data.access_token, 'session');
            // Calculate expiry (expires_in is in seconds)
            const expiresAt = new Date().getTime() + (data.expires_in * 1000) - 60000; // Buffer 1 min
            Storage.set('expires_at', expiresAt, 'session');

            // DEBUG: Show what we got
            alert('LOGIN SUCCESS!\n\nRequested: ' + SCOPES + '\n\nGRANTED: ' + data.scope + '\n\nPlease verify that the GRANTED scopes match the REQUESTED scopes.');

            // Clean up
            Storage.remove('code_verifier', 'session');
            Storage.remove('auth_state', 'session');

            // Remove query params from URL
            window.history.replaceState({}, document.title, import.meta.env.BASE_URL || '/');

            return true;
        } catch (err) {
            console.error('Token exchange failed:', err);
            alert('Token exchange failed: ' + err.message);
            return false;
        }
    },

    logout: () => {
        Storage.clear('session');
        // Optional: Revoke token via API
        window.location.reload();
    }
};

export default Auth;
