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
                // 轻量翻译引擎：transformers.js 内部动态 require onnxruntime 平台二进制，
                // 不能被打包器处理，必须整体 external 由 node_modules 运行时加载。
                '@huggingface/transformers',
                'onnxruntime-node',
                // Proxy stack: loaded at runtime from `node_modules` (shipped via forge ignore list)
                'undici',
                'fetch-socks',
                'ipaddr.js',
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
