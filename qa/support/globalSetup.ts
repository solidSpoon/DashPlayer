/**
 * Playwright globalSetup：用例开跑前把「料」备齐。
 *
 * 备两样东西，全部按需（已有的不动），所以第一次跑和改了 src 之后跑都不需要手工命令：
 * 1. 应用构建产物 `.vite/`：缺失，或 `src/` 里有文件比构建产物新，就重新构建
 *    （Playwright 以 `electron .` 加载它；拿旧产物跑等于测旧代码，比不跑更糟）；
 * 2. 媒体夹具 `fixtures/media/`：SRT 或视频缺失就生成（工具在 `fixtures/make-fixtures.mjs`）。
 *
 * 两者都只写本地目录，不入库（媒体夹具已在 `qa/.gitignore` 里排除）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 仓库根目录（本文件在 `qa/support/` 下）。
 * 用 `__dirname` 而不是 `import.meta.url`：Playwright 把 TS 配置/初始化脚本按 CJS 转译，
 * `import.meta` 在 CJS 里不可用（会直接报 "Cannot use 'import.meta' outside a module"）。
 */
const projectDir = path.resolve(__dirname, '..', '..');

/** 构建产物入口：存在即认为构建过。 */
const BUILD_ENTRY = path.join(projectDir, '.vite', 'build', 'main.js');

/** 需要参与「过期」判断的源码目录。 */
const SOURCE_DIRS = ['src', 'qa/support'];

/** 媒体夹具目录与必需产物。 */
const MEDIA_DIR = path.join(projectDir, 'qa', 'fixtures', 'media');
const MEDIA_FILES = ['qa-bilingual.srt', 'qa-bilingual.mp4'];

/**
 * 递归取目录下最新的 mtime（毫秒）。
 *
 * @param dir 目录绝对路径。
 * @returns 最新 mtime；目录不存在时为 0。
 */
const newestMtime = (dir: string): number => {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    let newest = 0;
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop() as string;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
                continue;
            }
            newest = Math.max(newest, fs.statSync(full).mtimeMs);
        }
    }
    return newest;
};

/**
 * 需要时重新构建 `.vite` 产物。
 *
 * @returns 构建发生时为 true。
 */
const ensureBuild = (): boolean => {
    const buildMtime = fs.existsSync(BUILD_ENTRY) ? fs.statSync(BUILD_ENTRY).mtimeMs : 0;
    const sourceMtime = Math.max(...SOURCE_DIRS.map((dir) => newestMtime(path.join(projectDir, dir))));
    if (buildMtime > 0 && buildMtime >= sourceMtime) {
        return false;
    }
    const result = spawnSync(process.execPath, [path.join(projectDir, 'qa', 'support', 'build.mjs')], {
        cwd: projectDir,
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        throw new Error(`应用构建失败（exit ${result.status}）`);
    }
    return true;
};

/**
 * 需要时生成媒体夹具。
 *
 * @returns 生成发生时为 true。
 */
const ensureFixtures = (): boolean => {
    const missing = MEDIA_FILES.filter((name) => !fs.existsSync(path.join(MEDIA_DIR, name)));
    if (missing.length === 0) {
        return false;
    }
    const result = spawnSync(process.execPath, [path.join(projectDir, 'qa', 'fixtures', 'make-fixtures.mjs')], {
        cwd: projectDir,
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        throw new Error(`媒体夹具生成失败（exit ${result.status}）：缺 ${missing.join('、')}`);
    }
    return true;
};

/**
 * Playwright globalSetup 入口。
 *
 * @returns 备料完成后结束。
 */
export default function globalSetup(): void {
    const built = ensureBuild();
    const fixtures = ensureFixtures();
    console.log(`[qa] 备料完成：${built ? '已重建 .vite' : '.vite 是最新的'}，${fixtures ? '已生成媒体夹具' : '媒体夹具已存在'}`);
}
