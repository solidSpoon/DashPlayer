import { expect, type Locator, type Page } from '@playwright/test';
import { readConfigValue, test } from './fixtures';
import { openSettingsSection, reloadSettingsPage } from './settings-page';

/** 进入快捷键设置页。 */
async function openShortcutSetting(page: Page): Promise<void> {
    await openSettingsSection(page, '快捷键', page.getByRole('heading', { name: '快捷键' }));
}

/**
 * 定位某一行的快捷键配置项。
 *
 * @param page 应用主窗口页面。
 * @param title 该行的中文功能名（如「单句重播」）。
 */
function shortcutRow(page: Page, title: string): Locator {
    return page.getByRole('row').filter({ hasText: title });
}

/** 打开某行的编辑弹窗（铅笔按钮）。 */
async function openShortcutDialog(page: Page, title: string): Promise<Locator> {
    await shortcutRow(page, title).getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
}

test.describe('快捷键设置', () => {
    test('[SET-SHT-01] 改完单个快捷键后落盘，重进页面仍回显；恢复默认同样落盘', async ({ session, userDataDir }) => {
        const page = session.page;
        await openShortcutSetting(page);

        // 默认绑定是 r
        await expect(shortcutRow(page, '单句重播')).toContainText('R');

        // 编辑弹窗里录一个额外的按键（y），再保存回表单
        await openShortcutDialog(page, '单句重播');
        await page.keyboard.press('y');
        await page.getByRole('button', { name: '添加此按键' }).click();
        await page.getByRole('button', { name: '完成并保存' }).click();

        await expect.poll(() => readConfigValue(userDataDir, 'shortcut.repeatSingleSentence')).toBe('r,y');

        // 重进页面：新按键来自后端回读
        await reloadSettingsPage(page, page.getByRole('heading', { name: '快捷键' }));
        await expect(shortcutRow(page, '单句重播')).toContainText('Y');

        // 恢复默认同样要写回配置，而不是只改界面
        await shortcutRow(page, '单句重播').getByRole('button').nth(1).click();
        await expect.poll(() => readConfigValue(userDataDir, 'shortcut.repeatSingleSentence')).toBe('r');
        await expect(shortcutRow(page, '单句重播')).not.toContainText('Y');
    });

    test('[SET-SHT-02] 清空某个功能的全部按键会落盘为空绑定，重进页面显示未绑定且不影响其它功能', async ({ session, userDataDir }) => {
        const page = session.page;
        await openShortcutSetting(page);

        // 先给另一个功能改键：清空是一整份表单一起保存的，稍后用它验证别的功能没被带回默认
        await openShortcutDialog(page, '单句重播');
        await page.keyboard.press('y');
        await page.getByRole('button', { name: '添加此按键' }).click();
        await page.getByRole('button', { name: '完成并保存' }).click();
        await expect.poll(() => readConfigValue(userDataDir, 'shortcut.repeatSingleSentence')).toBe('r,y');

        // 播放/暂停默认绑定三个按键，清空前先确认界面显示的是存储值
        const playPauseRow = shortcutRow(page, '播放 / 暂停');
        await expect(playPauseRow).toContainText('Space');
        await expect(playPauseRow).toContainText('W');

        const dialog = await openShortcutDialog(page, '播放 / 暂停');
        await dialog.getByRole('button', { name: '清空全部' }).click();
        await dialog.getByRole('button', { name: '完成并保存' }).click();

        // 快捷键允许空串，表示显式取消绑定：必须真的写进配置而不是被当成「没填」跳过
        await expect.poll(() => readConfigValue(userDataDir, 'shortcut.playPause')).toBe('');
        await expect.poll(() => readConfigValue(userDataDir, 'shortcut.repeatSingleSentence')).toBe('r,y');

        // 重进页面：该行显示为未绑定，别的功能仍保留刚才改的键
        await reloadSettingsPage(page, page.getByRole('heading', { name: '快捷键' }));
        await expect(shortcutRow(page, '播放 / 暂停')).toContainText('—');
        await expect(shortcutRow(page, '播放 / 暂停')).not.toContainText('Space');
        await expect(shortcutRow(page, '单句重播')).toContainText('Y');
    });

    test('[SET-SHT-03] 搜索框按功能名与按键过滤，且搜索内容不会被当成设置保存', async ({ session, userDataDir }) => {
        const page = session.page;
        await openShortcutSetting(page);

        const search = page.getByPlaceholder('搜索快捷键或功能名称...');

        // 正常态下四个分组的功能行都在
        await expect(shortcutRow(page, '单句重播')).toBeVisible();
        await expect(shortcutRow(page, '打开 AI 对话')).toBeVisible();

        // 按功能名过滤
        await search.fill('播放 / 暂停');
        await expect(shortcutRow(page, '播放 / 暂停')).toBeVisible();
        await expect(shortcutRow(page, '单句重播')).toHaveCount(0);

        // 按按键过滤：AI 对话默认绑定 slash，输入按键名也能命中
        await search.fill('slash');
        await expect(shortcutRow(page, '打开 AI 对话')).toBeVisible();
        await expect(shortcutRow(page, '播放 / 暂停')).toHaveCount(0);

        await search.fill('这个功能不存在');
        await expect(page.getByText('未找到匹配的快捷键')).toBeVisible();

        await search.fill('');
        await expect(shortcutRow(page, '单句重播')).toBeVisible();

        // 搜索框只是列表过滤器，不是设置项：重进页面后应为空
        await reloadSettingsPage(page, page.getByRole('heading', { name: '快捷键' }));
        await expect(page.getByPlaceholder('搜索快捷键或功能名称...')).toHaveValue('');
        expect(readConfigValue(userDataDir, 'shortcut.searchQuery')).toBeUndefined();
    });
});
