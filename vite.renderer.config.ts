import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const enableReactCompiler = process.env.REACT_COMPILER === '1';

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        react(
            enableReactCompiler
                ? {
                    babel: {
                        plugins: ['babel-plugin-react-compiler'],
                    },
                }
                : undefined
        ),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
