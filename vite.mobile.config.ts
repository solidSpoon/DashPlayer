import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 手机页需要的图标：构建产物里的文件名，以及它在 assets/icons 里的来源。
 *
 * 图标只在 assets/icons 维护，构建时原样复制进 resources/mobile 由 HTTP 服务托管，
 * 避免把同一张图在 public 目录里再存一份、以后改图忘同步。
 *
 * - favicon-16/32.png 是标签页图标，覆盖 1x 与 2x 标签栏；
 * - apple-touch-icon.png 是 iOS「添加到主屏幕」用的图标，只认位图，直接用应用图标原图
 *   （512×512，iOS 会自行缩到 180×180 并加圆角）。
 */
const MOBILE_ICONS: { fileName: string; source: string }[] = [
    { fileName: 'favicon-16.png', source: 'assets/icons/16x16.png' },
    { fileName: 'favicon-32.png', source: 'assets/icons/32x32.png' },
    { fileName: 'apple-touch-icon.png', source: 'assets/icons/icon.png' },
];

/**
 * 把应用图标放进手机页构建产物。
 *
 * 用插件而不是 public 目录复制，是为了让图标只有 assets/icons 一个来源；
 * generateBundle 在每次构建（含 --watch 的增量构建）都会跑，所以改了图标重跑即可。
 */
const mobileIconPlugin = (): Plugin => ({
    name: 'dashplayer-mobile-icons',
    generateBundle() {
        for (const icon of MOBILE_ICONS) {
            this.emitFile({
                type: 'asset',
                fileName: icon.fileName,
                source: fs.readFileSync(path.resolve(__dirname, icon.source)),
            });
        }
    },
});

/**
 * 手机版是独立的 React 入口，不跟 Electron renderer 共用一个构建。
 *
 * 构建产物直接落到 resources/mobile，由主进程的 HTTP 服务托管；这个目录是
 * 生成物，不进仓库，打包时随 extraResource 一起带走。
 */
export default defineConfig({
    root: path.resolve(__dirname, 'src/mobile'),
    base: '/',
    plugins: [react(), mobileIconPlugin()],
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
