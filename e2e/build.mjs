#!/usr/bin/env node
/**
 * 生成 e2e 运行所需的生产构建产物（.vite/build 与 .vite/renderer/main_window）。
 *
 * 为什么不用 `electron-forge package`：
 * - 打包产物会被 FusesPlugin 关闭 `--inspect` 等 Node 调试参数（EnableNodeCliInspectArguments: false），
 *   Playwright 驱动 Electron 依赖主进程 inspector，无法接管打包版；
 * - 打包还要求 extraResource 里的 lib/ 已由 `yarn run download` 生成，
 *   而 e2e 用例不需要 ffmpeg/whisper 运行时，不应为跑用例触发大体积下载。
 *
 * 因此这里复用 forge Vite 插件的构建逻辑（与 `electron-forge package` 的
 * prePackage 构建同源），只产出 .vite 产物，由 Playwright 以开发态（electron .）启动。
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import * as vite from 'vite';

const require = createRequire(import.meta.url);
const projectDir = fileURLToPath(new URL('..', import.meta.url));

// plugin-vite 的构建入口不在包 exports 里，只能按文件路径加载；
// plugin-vite 升级导致内部结构变化时这里会直接失败，不会静默产出错误产物。
const vitePluginDist = path.dirname(require.resolve('@electron-forge/plugin-vite'));
const ViteConfigGenerator = require(path.join(vitePluginDist, 'ViteConfig.js')).default;

// forge.config.ts 是 TS，用 ts-node 以 CJS 方式加载（与 forge CLI 的加载方式一致）
require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const forgeConfig = require(path.join(projectDir, 'forge.config.ts')).default;
const vitePlugin = forgeConfig.plugins.find((plugin) => plugin.name === 'vite');
if (!vitePlugin) {
    throw new Error('forge.config.ts 中未找到 VitePlugin');
}

const outDir = path.join(projectDir, '.vite');
await fs.rm(outDir, { recursive: true, force: true });

// isProd = true 与打包时的构建完全一致：渲染端不再注入 dev server 地址，
// 主进程会从 .vite/renderer/main_window/index.html 加载页面。
const generator = new ViteConfigGenerator(vitePlugin.config, projectDir, true);
const configs = [...(await generator.getBuildConfigs()), ...(await generator.getRendererConfig())];

for (const config of configs) {
    await vite.build({
        ...config,
        // 防止再次加载用户 vite 配置造成递归
        configFile: false,
        logLevel: 'warn',
        clearScreen: false,
    });
}

console.log('[e2e] 构建完成：.vite/build + .vite/renderer/main_window');
