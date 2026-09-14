import { expect, type Page, type Locator } from '@playwright/test';
import { launchAppSession, readConfigValue, test } from './fixtures';
import { openSettingsSection, reloadSettingsPage, selectInRow, switchSettingsSection } from './settings-page';

/** 主题按钮文案到根节点主题类名的映射。 */
const THEME_CLASS = { 深色: 'dark', 浅色: 'light' } as const;
type ThemeLabel = keyof typeof THEME_CLASS;

/**
 * 进入外观设置页：首页「设置中心」→ 设置页侧边栏「外观」。
 *
 * @param page 应用主窗口页面。
 */
async function openAppearanceSetting(page: Page): Promise<void> {
    await openSettingsSection(page, '外观', page.getByRole('button', { name: '深色' }));
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

/**
 * 定位「界面字号」那一行，行内有小/中/大三个按钮。
 *
 * @param page 应用主窗口页面。
 */
function fontSizeRow(page: Page): Locator {
    return page
        .locator('div')
        .filter({ hasText: '调整主要界面的文字尺寸' })
        .filter({ has: page.getByRole('button') })
        .last();
}

/**
 * 取字号行里的某个档位按钮。
 *
 * @param page 应用主窗口页面。
 * @param label 档位文案：「小」「中」或「大」。
 */
function fontSizeButton(page: Page, label: string): Locator {
    return fontSizeRow(page).getByRole('button').filter({ hasText: label });
}

test.describe('外观设置', () => {
    test('[SET-APP-01] 切换主题后界面立即生效并写入配置', async ({ session, userDataDir }) => {
        await openAppearanceSetting(session.page);

        // 全新配置的默认主题是浅色
        await expect(session.page.locator('html')).toHaveClass(/\blight\b/);

        await switchTheme(session.page, '深色');

        // 主题不只是停留在界面状态，还要落到配置文件里
        await expect.poll(() => readConfigValue(userDataDir, 'appearance.theme')).toBe('dark');
    });

    test('[SET-APP-02] 重启应用后沿用上次选择的主题', async ({ userDataDir }) => {
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

    test('[SET-APP-03] 切换界面字号后写入配置，重进页面仍回显所选档位', async ({ session, userDataDir }) => {
        const page = session.page;
        await openAppearanceSetting(page);

        // 全新配置的默认字号是「大」，选中态体现在按钮的 ring 上
        await expect(fontSizeButton(page, '大')).toHaveClass(/ring-1/);

        await fontSizeButton(page, '小').click();

        await expect.poll(() => readConfigValue(userDataDir, 'appearance.fontSize')).toBe('fontSizeSmall');

        // 重进页面：选中档位来自后端回读，而不是页面里的临时 state
        await reloadSettingsPage(page, page.getByRole('button', { name: '深色' }));
        await expect(fontSizeButton(page, '小')).toHaveClass(/ring-1/);
        await expect(fontSizeButton(page, '大')).not.toHaveClass(/ring-1/);
    });

    test('[SET-APP-04] 切换界面语言后写入配置，重进页面按所选语言渲染', async ({ session, userDataDir }) => {
        const page = session.page;
        await openAppearanceSetting(page);

        await selectInRow(page, '界面语言').click();
        await page.getByRole('option', { name: 'English' }).click();

        await expect.poll(() => readConfigValue(userDataDir, 'i18n.language')).toBe('en-US');

        // 重进页面：整个界面按持久化的语言设置渲染成英文，语言下拉也停在 English
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
        await expect(page.getByRole('combobox')).toHaveText('English');
    });

    test('[SET-APP-05] 主题从深色切回浅色同样落盘，重启后不回弹到深色', async ({ userDataDir }) => {
        const first = await launchAppSession(userDataDir);
        try {
            await openAppearanceSetting(first.page);

            // 先切到深色，让配置里存在一个非默认值
            await switchTheme(first.page, '深色');
            await expect.poll(() => readConfigValue(userDataDir, 'appearance.theme')).toBe('dark');

            // 再切回浅色。浅色是 schema 默认值，反向路径才是关口：
            // 若「写回默认值」被当成「没改动」而跳过，界面会显示浅色、配置文件却还是深色，
            // 用户下次启动就会看到主题弹回深色。
            await switchTheme(first.page, '浅色');
            await expect.poll(() => readConfigValue(userDataDir, 'appearance.theme')).toBe('light');
        } finally {
            await first.close();
        }

        const restarted = await launchAppSession(userDataDir);
        try {
            // 重启后是浅色。这一步单独看说明不了问题（默认值恰好也是浅色），
            // 上面的写盘断言才是证明「真的覆盖了」的那一半，两者一起才闭合。
            await expect(restarted.page.locator('html')).toHaveClass(/\blight\b/);
            await openAppearanceSetting(restarted.page);
            await expect(restarted.page.getByRole('button', { name: '浅色' })).toHaveClass(/ring-1/);
        } finally {
            await restarted.close();
        }
    });

    test('[SET-APP-09] 选完主题立刻切到别的设置栏目，主题仍会落盘并在重进后回显选中', async ({ session, userDataDir }) => {
        const page = session.page;
        await openAppearanceSetting(page);

        await page.getByRole('button', { name: '深色' }).click();
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);

        // 关键：点完立刻离开，不给 600ms 防抖留时间。主题是立即可见的界面状态，
        // 用户很容易「点完就走」，此时若丢值，重进页面选中项会退回浅色。
        await switchSettingsSection(page, '网络代理', page.getByRole('heading', { name: '网络代理' }));

        await expect.poll(() => readConfigValue(userDataDir, 'appearance.theme')).toBe('dark');

        // 回到该页：选中态来自后端回读，而不是页面里残留的 state
        await switchSettingsSection(page, '外观', page.getByRole('button', { name: '深色' }));
        await expect(page.getByRole('button', { name: '深色' })).toHaveClass(/ring-1/);
    });
});
