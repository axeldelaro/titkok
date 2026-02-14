import Auth from './auth.js';
import Storage from './storage.js';

const BASE_URL = 'https://photoslibrary.googleapis.com/v1';

const API = {
    // Retry configuration
    retryCount: 3,
    retryDelay: 1000,

    request: async (endpoint, options = {}) => {
        let attempts = 0;

        while (attempts < API.retryCount) {
            try {
                const token = Auth.getAccessToken();
                if (!token) {
                    alert('DEBUG: No access token found! isAuthenticated=' + Auth.isAuthenticated());
                    throw new Error('No access token');
                }

                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                };

                const response = await fetch(`${BASE_URL}${endpoint}`, {
                    ...options,
                    headers
                });

                if (response.status === 401) {
                    const errBody = await response.text();
                    alert('DEBUG 401: Token=' + token.substring(0, 20) + '... Endpoint=' + endpoint + ' Response=' + errBody.substring(0, 200));
                    Auth.logout();
                    throw new Error('Unauthorized');
                }

                if (response.status === 429) {
                    // Rate limit
                    const retryAfter = response.headers.get('Retry-After') || 1;
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                    attempts++;
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                attempts++;
                if (attempts >= API.retryCount) throw error;
                await new Promise(r => setTimeout(r, API.retryDelay * attempts));
            }
        }
    },

    searchVideos: async (pageToken = null, pageSize = 25) => {
        // Cache key logic could go here

        const body = {
            pageSize,
            filters: {
                mediaTypeFilter: {
                    mediaTypes: ['VIDEO']
                }
            }
        };

        if (pageToken) {
            body.pageToken = pageToken;
        }

        return API.request('/mediaItems:search', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    getVideo: async (id) => {
        return API.request(`/mediaItems/${id}`);
    },

    getUserInfo: async () => {
        const token = Auth.getAccessToken();
        if (!token) throw new Error('No access token');

        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch user info');
        return response.json();
    },

    searchByFilename: async (query, pageToken = null, pageSize = 25) => {
        // Google Photos API doesn't support filename search directly,
        // so we fetch all videos and filter client-side
        const body = {
            pageSize,
            filters: {
                mediaTypeFilter: {
                    mediaTypes: ['VIDEO']
                }
            }
        };

        if (pageToken) {
            body.pageToken = pageToken;
        }

        const data = await API.request('/mediaItems:search', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (data && data.mediaItems) {
            const lowerQuery = query.toLowerCase();
            data.mediaItems = data.mediaItems.filter(item =>
                item.filename.toLowerCase().includes(lowerQuery)
            );
        }

        return data;
    }
};

export default API;
