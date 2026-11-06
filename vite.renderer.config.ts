import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const reactCompilerEnv = process.env.REACT_COMPILER?.toLowerCase();
const enableReactCompiler =
    reactCompilerEnv !== '0' && reactCompilerEnv !== 'false' && reactCompilerEnv !== 'off';

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        tailwindcss(),
        react(
            enableReactCompiler
                ? {
                    // plugin-react 6 起不再接受 babel 配置，编译器改由 oxc-transform-react
                    // （React Compiler 的 Rust 实现）承担。
                    compiler: true,
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
