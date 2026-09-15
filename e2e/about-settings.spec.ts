import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';
import { openSettingsSection } from './settings-page';

/** 进入关于与更新设置页。 */
async function openAboutSetting(page: Page): Promise<void> {
    await openSettingsSection(page, '关于与更新', page.getByRole('heading', { name: '关于与更新' }));
}

test.describe('关于与更新设置', () => {
    test('[SET-ABT-01] 只有只读入口，页面里没有需要保存的输入项', async ({ session }) => {
        const page = session.page;
        await openAboutSetting(page);

        // 版本号来自后端，是这一页唯一的动态内容
        await expect(page.getByText(/^v\d+\.\d+\.\d+/).first()).toBeVisible();

        // 只读页的守卫：一旦误加了没有保存链路的输入控件，这条用例会失败
        await expect(page.getByRole('main').locator('input, textarea, select')).toHaveCount(0);
    });
});
