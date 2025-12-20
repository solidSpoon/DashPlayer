import { defineConfig } from 'vite';
import path from 'node:path';
import packageJson from './package.json';

const dependencies = Object.keys(packageJson.dependencies ?? {});

// https://vitejs.dev/config
export default defineConfig({
    build: {
        // https://github.com/electron/forge/issues/3398
        sourcemap: true,
        target: 'node20',
        rollupOptions: {
            external: [
                ...dependencies,
                'echogarden',
                'echogarden/dist/api/API.js',
                'echogarden/dist/audio/AudioUtilities.js',
                'echogarden/dist/utilities/Timeline.js',
                'echogarden/dist/utilities/PackageManager.js',
            ],
            output: {
                strict: false,
            },
        },
    },
    optimizeDeps: {
        exclude: ['echogarden'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
