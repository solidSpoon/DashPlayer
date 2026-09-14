import { expect, type Page } from '@playwright/test';
import { readConfigValue, test } from './fixtures';
import { openSettingsSection, reloadSettingsPage } from './settings-page';

/** 进入网络代理设置页。 */
async function openProxySetting(page: Page): Promise<void> {
    await openSettingsSection(page, '网络代理', page.getByRole('heading', { name: '网络代理' }));
}

/** 页面上填写的代理地址，故意与输入框占位符不同，便于区分「回显了」和「只是占位符」。 */
const PROXY_URL = 'http://127.0.0.1:7897';
/** 页面上填写的直连规则。 */
const BYPASS_RULES = 'localhost,127.0.0.1,*.e2e.test';

test.describe('网络代理设置', () => {
    test('[SET-PRX-01] 切到自定义并填写代理地址与直连规则后落盘，重进页面仍回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openProxySetting(page);

        // 全新配置默认跟随系统，此时地址与规则不展示
        await expect(page.getByRole('combobox')).toHaveText('跟随系统');

        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: '自定义' }).click();

        await page.getByPlaceholder('http://127.0.0.1:7890').fill(PROXY_URL);
        await page.getByPlaceholder('localhost,127.0.0.1').fill(BYPASS_RULES);

        // 设置页没有保存按钮，改动由页面防抖自动保存到配置文件
        await expect.poll(() => readConfigValue(userDataDir, 'proxy.mode')).toBe('custom');
        await expect.poll(() => readConfigValue(userDataDir, 'proxy.url')).toBe(PROXY_URL);
        await expect.poll(() => readConfigValue(userDataDir, 'proxy.bypass_rules')).toBe(BYPASS_RULES);

        // 重进页面：值来自后端回读，而不是页面里残留的输入
        await reloadSettingsPage(page, page.getByRole('heading', { name: '网络代理' }));
        await expect(page.getByRole('combobox')).toHaveText('自定义');
        await expect(page.getByPlaceholder('http://127.0.0.1:7890')).toHaveValue(PROXY_URL);
        await expect(page.getByPlaceholder('localhost,127.0.0.1')).toHaveValue(BYPASS_RULES);
    });

    test('[SET-PRX-02] 切到不使用代理后模式落盘，重进页面仍回显且不再展示地址输入', async ({ session, userDataDir }) => {
        const page = session.page;
        await openProxySetting(page);

        await expect(page.getByRole('combobox')).toHaveText('跟随系统');

        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: '不使用' }).click();

        await expect.poll(() => readConfigValue(userDataDir, 'proxy.mode')).toBe('none');

        // 重进页面：模式来自后端回读，且该模式下没有可填写的代理地址
        await reloadSettingsPage(page, page.getByRole('heading', { name: '网络代理' }));
        await expect(page.getByRole('combobox')).toHaveText('不使用');
        await expect(page.getByPlaceholder('http://127.0.0.1:7890')).toHaveCount(0);
        await expect(page.getByPlaceholder('localhost,127.0.0.1')).toHaveCount(0);
    });
});
