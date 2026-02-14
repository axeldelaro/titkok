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
            }
        },
        resolve: {
            alias: {
                '/src': path.resolve(__dirname, 'src')
            }
        }
    };
});
