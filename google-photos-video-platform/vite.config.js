import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'public',
    publicDir: '../static', // If we had specific static assets not in public (which is now root)
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
            // Allow serving files from one level up to the project root
            allow: ['..']
        }
    },
    resolve: {
        alias: {
            '/src': path.resolve(__dirname, 'src')
        }
    }
});
