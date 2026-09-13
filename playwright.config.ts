import { defineConfig } from '@playwright/test';

/**
 * e2e 配置：只承载 Electron 端到端用例。
 *
 * 使用方式：
 * - `yarn test:e2e`：先执行 e2e/build.mjs 生成 .vite 产物，再跑本配置；
 * - 迭代时可直接 `yarn e2e:run` 复用已有产物。
 *
 * 说明：用例通过 Playwright 的 Electron 支持驱动本地 Electron 二进制，
 * 不使用 Playwright 自带浏览器，安装依赖时已跳过浏览器下载。
 */
export default defineConfig({
    testDir: './e2e',
    // 每个用例都会真实启动一个 Electron 实例，串行执行避免窗口互相干扰
    workers: 1,
    fullyParallel: false,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: [['list']],
});
