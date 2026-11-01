import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 手机页需要的图标：构建产物里的文件名，以及它在 assets/icons 里的来源。
 *
 * - favicon-16/32.png 是标签页图标，覆盖 1x 与 2x 标签栏；
 * - apple-touch-icon.png 是 iOS「添加到主屏幕」用的图标，只认位图。这个文件是满幅方图
 *   （无透明边距、无自带圆角）：iOS 会给主屏图标自己加圆角，图标若自带圆角底板，
 *   就会变成「圆角矩形套圆角矩形」，四角还露出一圈投影。
 *   改应用图标后需要重新生成它：从 assets/icons/icon@2x.png 裁掉投影和透明边距
 *   （保留 829×829 的底板区域）、缩放到 180、把四角透明处压成底板白。
 */
const MOBILE_ICONS: { fileName: string; source: string }[] = [
    { fileName: 'favicon-16.png', source: 'assets/icons/16x16.png' },
    { fileName: 'favicon-32.png', source: 'assets/icons/32x32.png' },
    { fileName: 'apple-touch-icon.png', source: 'assets/icons/apple-touch-180.png' },
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
