import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        // https://github.com/electron/forge/issues/3398
        sourcemap: true,
        target: 'node20',
        rollupOptions: {
            external: [
                // Native / non-bundle-friendly deps (ship via `node_modules` in the packaged app)
                'better-sqlite3',
                // `fluent-ffmpeg` has a conditional require to a missing `lib-cov/` entry.
                'fluent-ffmpeg',
            ],
            output: {
                strict: false,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
