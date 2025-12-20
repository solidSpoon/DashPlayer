import { defineConfig } from 'vite';
import path from 'node:path';
import packageJson from './package.json';

const dependencies = Object.keys(packageJson.dependencies ?? {});

// https://vitejs.dev/config
export default defineConfig({
    build: {
        rollupOptions: {
            external: dependencies,
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
