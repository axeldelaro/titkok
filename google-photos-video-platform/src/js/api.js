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

                const url = new URL(`${BASE_URL}${endpoint}`);
                // url.searchParams.append('access_token', token); // REMOVED: Deprecated/Unreliable

                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                };

                const response = await fetch(url.toString(), {
                    ...options,
                    headers
                });

                if (response.status === 401 || response.status === 403) {
                    const errBody = await response.text();
                    console.error('API Error details:', errBody);

                    let errorMsg = `API Error ${response.status}`;
                    let isScopeError = false;

                    try {
                        const jsonErr = JSON.parse(errBody);
                        if (jsonErr.error && jsonErr.error.message) {
                            errorMsg += `: ${jsonErr.error.message}`;
                            // Check for common scope/permission errors
                            if (jsonErr.error.message.includes('insufficient authentication scopes') ||
                                jsonErr.error.message.includes('permission') ||
                                jsonErr.error.status === 'PERMISSION_DENIED') {
                                isScopeError = true;
                            }
                        }
                    } catch (e) {
                        errorMsg += `: ${errBody}`;
                    }

                    if (isScopeError) {
                        alert(`PERMISSION ERROR: ${errorMsg}\n\nThe app needs updated permissions. You will be logged out. Please log in again and ensure you check ALL scope boxes.`);
                        Auth.logout();
                    } else if (response.status === 401) {
                        Auth.logout(); // Token expired or invalid
                    } else {
                        alert(errorMsg + '\n\nCheck console for details.');
                    }

                    throw new Error(response.statusText);
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
