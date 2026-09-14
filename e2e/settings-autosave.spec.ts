import { expect } from '@playwright/test';
import { readConfigValue, test } from './fixtures';
import { openSettingsSection, switchSettingsSection } from './settings-page';

/** 页面上填写的代理地址。 */
const PROXY_URL = 'http://127.0.0.1:7897';

test.describe('设置页自动保存时机', () => {
    test('[SET-AUTO-01] 改完立刻切到别的设置栏目，改动仍会落盘并在重进后回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openSettingsSection(page, '网络代理', page.getByRole('heading', { name: '网络代理' }));
        await expect(page.getByRole('combobox')).toHaveText('跟随系统');

        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: '自定义' }).click();
        await page.getByPlaceholder('http://127.0.0.1:7890').fill(PROXY_URL);

        // 关键：改完立刻离开，不给 600ms 防抖留时间。离开时挂起的改动必须被提交，
        // 否则用户「填完随手切走」的改动会静默消失，正是最常被投诉的丢值场景。
        await switchSettingsSection(page, '外观', page.getByRole('button', { name: '深色' }));

        await expect.poll(() => readConfigValue(userDataDir, 'proxy.mode')).toBe('custom');
        await expect.poll(() => readConfigValue(userDataDir, 'proxy.url')).toBe(PROXY_URL);

        // 回到该页：显示的是后端回读的值，而不是靠页面残留的输入蒙对
        await switchSettingsSection(page, '网络代理', page.getByRole('heading', { name: '网络代理' }));
        await expect(page.getByRole('combobox')).toHaveText('自定义');
        await expect(page.getByPlaceholder('http://127.0.0.1:7890')).toHaveValue(PROXY_URL);
    });
});
