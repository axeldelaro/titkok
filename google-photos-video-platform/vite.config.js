import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
    // Load env from project root (not from 'public' which is root)
    const env = loadEnv(mode, path.resolve(__dirname), '');

    return {
        base: '/titkok/',
        root: 'public',
        envDir: path.resolve(__dirname),
        publicDir: '../static',
        define: {
            'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
                env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
            ),
            'import.meta.env.VITE_GOOGLE_CLIENT_SECRET': JSON.stringify(
                env.VITE_GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || ''
            ),
            'import.meta.env.VITE_GOOGLE_PROJECT_ID': JSON.stringify(
                env.VITE_GOOGLE_PROJECT_ID || process.env.VITE_GOOGLE_PROJECT_ID || ''
            ),
        },
        build: {
            outDir: '../dist',
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'public/index.html'),
                    video: path.resolve(__dirname, 'public/video.html'),
                    playlist: path.resolve(__dirname, 'public/playlist.html'),
                    profile: path.resolve(__dirname, 'public/profile.html'),
                }
            }
        },
        server: {
            fs: {
                allow: ['..']
            },
            proxy: {
                '/api/proxy-media': {
                    target: 'https://lh3.googleusercontent.com',
                    changeOrigin: true,
                    rewrite: (path) => {
                        const urlParams = new URLSearchParams(path.split('?')[1]);
                        const targetUrl = urlParams.get('url');
                        if (targetUrl) {
                            // Extract just the path part from lh3.googleusercontent.com/...
                            const targetPath = new URL(targetUrl).pathname + new URL(targetUrl).search;
                            return targetPath;
                        }
                        return path;
                    }
                }
            }
        },
        resolve: {
            alias: {
                '/src': path.resolve(__dirname, 'src')
            }
        }
    };
});
