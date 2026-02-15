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
                    console.warn('No access token found during request.');
                    throw new Error('No access token');
                }

                // Handle full URLs (like uploads) vs relative endpoints
                const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

                const headers = {
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                };

                // JSON content type is default unless specified otherwise (e.g. for raw uploads)
                if (!headers['Content-Type'] && !options.body instanceof ArrayBuffer && typeof options.body === 'string') {
                    headers['Content-Type'] = 'application/json';
                }

                const response = await fetch(url, {
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

                    if (isScopeError || response.status === 401) {
                        console.warn('Authentication error or missing scopes. Logging out.');
                        Auth.logout();
                        return; // Stop processing
                    } else {
                        throw new Error(errorMsg);
                    }
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
        // ... existing code ...
        return data; // Keep existing return
    },

    uploadVideo: async (file, onProgress) => {
        const token = Auth.getAccessToken();
        if (!token) throw new Error('No access token');

        // Step 1: Upload raw bytes
        // Note: fetch doesn't support progress monitoring easily without XMLHttpRequest or Streams
        // For simplicity, we'll just await the upload.

        console.log('Uploading bytes...');
        const uploadResponse = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-type': 'application/octet-stream',
                'X-Goog-Upload-Content-Type': file.type,
                'X-Goog-Upload-Protocol': 'raw'
            },
            body: file
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        const uploadToken = await uploadResponse.text();
        console.log('Got upload token, creating media item...');

        // Step 2: Create Media Item
        const createBody = {
            newMediaItems: [{
                description: "Uploaded via CloudStream",
                simpleMediaItem: {
                    uploadToken: uploadToken,
                    fileName: file.name
                }
            }]
        };

        const createResponse = await API.request('/mediaItems:batchCreate', {
            method: 'POST',
            body: JSON.stringify(createBody)
        });

        if (createResponse && createResponse.newMediaItemResults) {
            const result = createResponse.newMediaItemResults[0];
            if (result.status.message === 'Success' || result.status.code === 0) {
                return result.mediaItem;
            } else {
                throw new Error(`Creation failed: ${result.status.message}`);
            }
        }
        return null;
    }
};

export default API;
