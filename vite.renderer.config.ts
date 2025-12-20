import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        rollupOptions: {
            external: ['tiktoken', '@dqbd/tiktoken', '@dqbd/tiktoken/lite'],
        },
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    optimizeDeps: {
        exclude: ['tiktoken', '@dqbd/tiktoken', '@dqbd/tiktoken/lite'],
    },
});
