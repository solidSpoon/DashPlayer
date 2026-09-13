import { expect, type Page } from '@playwright/test';
import { launchAppSession, readConfigValue, test } from './fixtures';

/** 主题按钮文案到根节点主题类名的映射。 */
const THEME_CLASS = { 深色: 'dark', 浅色: 'light' } as const;
type ThemeLabel = keyof typeof THEME_CLASS;

/**
 * 进入外观设置页：首页「设置中心」→ 设置页侧边栏「外观」。
 *
 * @param page 应用主窗口页面。
 */
async function openAppearanceSetting(page: Page): Promise<void> {
    await page.getByRole('link', { name: '设置中心' }).click();
    await page.getByRole('link', { name: '外观' }).click();
    await expect(page.getByRole('button', { name: '深色' })).toBeVisible();
}

/**
 * 点击主题按钮，并等待主题真正生效（根节点类名变化）。
 *
 * @param page 应用主窗口页面。
 * @param theme 按钮文案：「深色」或「浅色」。
 */
async function switchTheme(page: Page, theme: ThemeLabel): Promise<void> {
    await page.getByRole('button', { name: theme }).click();
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${THEME_CLASS[theme]}\\b`));
}

test.describe('外观设置', () => {
    test('切换主题后界面立即生效并写入配置', async ({ session, userDataDir }) => {
        await openAppearanceSetting(session.page);

        // 全新配置的默认主题是浅色
        await expect(session.page.locator('html')).toHaveClass(/\blight\b/);

        await switchTheme(session.page, '深色');

        // 主题不只是停留在界面状态，还要落到配置文件里
        await expect.poll(() => readConfigValue(userDataDir, 'appearance.theme')).toBe('dark');
    });

    test('重启应用后沿用上次选择的主题', async ({ userDataDir }) => {
        const first = await launchAppSession(userDataDir);
        try {
            await openAppearanceSetting(first.page);
            await switchTheme(first.page, '深色');
            await expect.poll(() => readConfigValue(userDataDir, 'appearance.theme')).toBe('dark');
        } finally {
            await first.close();
        }

        const restarted = await launchAppSession(userDataDir);
        try {
            // 重启后不做任何操作，界面主题直接来自持久化配置
            await expect(restarted.page.locator('html')).toHaveClass(/\bdark\b/);

            // 再进外观页确认选中项回显为深色：选中态来自后端读回的设置，
            // 能排除「只是启动兜底类名恰好是深色」的假通过
            await openAppearanceSetting(restarted.page);
            await expect(restarted.page.getByRole('button', { name: '深色' })).toHaveClass(/ring-1/);
        } finally {
            await restarted.close();
        }
    });
});
