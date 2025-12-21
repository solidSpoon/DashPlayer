import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const reactCompilerEnv = process.env.REACT_COMPILER?.toLowerCase();
const enableReactCompiler =
    reactCompilerEnv !== '0' && reactCompilerEnv !== 'false' && reactCompilerEnv !== 'off';

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
