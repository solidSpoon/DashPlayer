import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * 手机版是独立的 React 入口，不跟 Electron renderer 共用一个构建。
 *
 * 构建产物直接落到 resources/mobile，由主进程的 HTTP 服务托管；这个目录是
 * 生成物，不进仓库，打包时随 extraResource 一起带走。
 */
export default defineConfig({
    root: path.resolve(__dirname, 'src/mobile'),
    base: '/',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: path.resolve(__dirname, 'resources/mobile'),
        emptyOutDir: true,
        target: 'es2020',
    },
});
