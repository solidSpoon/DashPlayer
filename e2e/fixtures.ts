import {
    test as base,
    _electron as electron,
    type ElectronApplication,
    type Page,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ONBOARDING_COMPLETED_VERSION_KEY } from '../src/common/constants/systemConfigKeys';

/** 当前引导版本号，与 OnboardingView 的 CURRENT_ONBOARDING_VERSION 一致。 */
const ONBOARDING_VERSION = '1';

/** 仓库根目录；`electron .` 会读取 package.json 的 main（.vite/build/main.js）。 */
const projectRoot = path.resolve(__dirname, '..');

/** 开发态配置文件：`electron .` 时 app.isPackaged 为 false，electron-store 文件名带 .dev 后缀。 */
const CONFIG_FILE_NAME = 'config.dev.json';

/** 一次应用会话：Electron 进程 + 已越过启动引导的主窗口。 */
export interface AppSession {
    /** Electron 进程句柄；重启场景可提前 close 后再建立新会话。 */
    app: ElectronApplication;
    /** 主窗口页面，处于主界面而非引导页。 */
    page: Page;
    /** 关闭应用进程；重复调用无副作用，便于用例内提前关闭。 */
    close: () => Promise<void>;
}

/**
 * 读取 userData 中的开发态配置文件，用于断言设置是否真正落盘。
 *
 * 注意 electron-store 默认按点号访问嵌套属性，文件里是嵌套结构：
 * appearance.theme 实际存为 {"appearance":{"theme":"dark"}}。
 *
 * @param userDataDir 用例独占的 userData 目录。
 * @returns 解析后的配置对象。
 */
export function readConfig(userDataDir: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(userDataDir, CONFIG_FILE_NAME), 'utf8')) as Record<string, unknown>;
}

/**
 * 按点号路径读取配置值。
 *
 * @param userDataDir 用例独占的 userData 目录。
 * @param key 形如 appearance.theme 的点号路径。
 * @returns 对应值；路径不存在时为 undefined。
 */
export function readConfigValue(userDataDir: string, key: string): unknown {
    return key.split('.').reduce<unknown>((node, segment) => {
        if (node === null || typeof node !== 'object') {
            return undefined;
        }
        return (node as Record<string, unknown>)[segment];
    }, readConfig(userDataDir));
}

/**
 * 创建用例独占的 userData 目录，并预置配置让运行环境确定且不污染真实数据：
 * - i18n.language 固定为中文，断言依赖的界面文案不随宿主系统语言漂移；
 * - storage.path 指向临时目录，避免应用在文档目录下创建媒体库。
 *
 * @returns 临时 userData 目录绝对路径。
 */
async function createUserDataDir(): Promise<string> {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dashplayer-e2e-'));
    await fs.promises.writeFile(
        path.join(dir, CONFIG_FILE_NAME),
        JSON.stringify({
            i18n: { language: 'zh-CN' },
            storage: { path: path.join(dir, 'library') },
        }),
        'utf8',
    );
    return dir;
}

/**
 * 越过首次使用引导，让应用进入主界面。
 *
 * 引导完成标记存在数据库里，无法在启动前预置；这里通过应用自身的配置接口
 * （与引导页「跳过」同一个后端入口）写入标记后刷新页面，不使用任何 mock。
 *
 * @param page 启动后的窗口页面（此时可能还在引导页或加载态）。
 */
async function passOnboardingGate(page: Page): Promise<void> {
    await page.waitForFunction(() => Boolean((window as { electron?: unknown }).electron));
    await page.evaluate(async (params: { key: string; value: string }) => {
        const handler = (window as unknown as {
            electron: { call: (path: string, param: unknown) => Promise<unknown> };
        }).electron;
        await handler.call('system/config/set', params);
    }, { key: ONBOARDING_COMPLETED_VERSION_KEY, value: ONBOARDING_VERSION });
    await page.reload();
    // 主界面（首页）导航里的「设置中心」入口，是引导页不会出现的内容
    await page.getByRole('link', { name: '设置中心' }).waitFor();
}

/**
 * 确认应用确实把状态写进了本轮用例的临时目录。
 *
 * 用例会真实建库、改设置，一旦 `--user-data-dir` 失效就会写坏本机真实数据，
 * 因此这里必须尽早失败，而不是让用例带着污染继续跑。
 *
 * @param userDataDir 用例独占的 userData 目录。
 */
async function assertUserDataIsolated(userDataDir: string): Promise<void> {
    // 开发态（electron .）的数据库位于 <userData>/data-dev，由启动迁移创建
    const databaseFile = path.join(userDataDir, 'data-dev', 'dp_db.sqlite3');
    if (!fs.existsSync(databaseFile)) {
        throw new Error(`应用未在隔离目录内建库，userData 可能没有切到 ${userDataDir}`);
    }
}

/**
 * 启动一次应用会话，并等待进入主界面。
 *
 * @param userDataDir 用例独占的 userData 目录。
 * @returns 应用会话；重启场景需先 close 再对同一目录调用本函数。
 */
export async function launchAppSession(userDataDir: string): Promise<AppSession> {
    const app = await electron.launch({
        args: ['.', `--user-data-dir=${userDataDir}`],
        cwd: projectRoot,
    });
    let closed = false;
    const close = async (): Promise<void> => {
        if (closed) {
            return;
        }
        closed = true;
        await app.close();
    };
    try {
        const page = await app.firstWindow();
        // 首窗口出现时启动迁移已完成，数据库落在隔离目录还是真实目录此时可判定
        await assertUserDataIsolated(userDataDir);
        await passOnboardingGate(page);
        return { app, page, close };
    } catch (error) {
        // 启动半途失败时先收掉进程，避免用例失败后残留 Electron 进程
        await close();
        throw error;
    }
}

type Fixtures = {
    /** 用例独占的 userData 目录，测试结束后自动删除。 */
    userDataDir: string;
    /** 已启动并处于主界面的应用会话。 */
    session: AppSession;
};

export const test = base.extend<Fixtures>({
    userDataDir: async ({}, use) => {
        const dir = await createUserDataDir();
        await use(dir);
        await fs.promises.rm(dir, { recursive: true, force: true });
    },
    session: async ({ userDataDir }, use) => {
        const session = await launchAppSession(userDataDir);
        await use(session);
        await session.close();
    },
});
