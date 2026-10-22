import { expect, type Locator, type Page } from '@playwright/test';

/**
 * 设置页用例共用的定位与导航工具。
 *
 * 设置页表单没有「保存」按钮，改完由页面防抖自动保存，所以用例的骨架统一是
 * 「操作 → 断言配置文件真的写了 → 重新加载页面断言回显」。
 */

/**
 * 从首页进入设置中心，再切到指定栏目。
 *
 * @param page 应用主窗口页面。
 * @param section 侧边栏里的中文栏目名（如「网络代理」）。
 * @param ready 该页独有的元素，用来确认页面已经切过去并完成初始化。
 */
export async function openSettingsSection(page: Page, section: string, ready: Locator): Promise<void> {
    await page.getByRole('link', { name: '设置中心' }).click();
    await switchSettingsSection(page, section, ready);
}

/**
 * 在设置中心内部切换到指定栏目（已在设置中心时使用）。
 *
 * 与 {@link openSettingsSection} 分开是为了让「从一个设置页切到另一个」的用例
 * 只经历一次导航——切走的瞬间正是要验证的时机，不能有多余的中间跳转。
 *
 * @param page 应用主窗口页面。
 * @param section 侧边栏里的中文栏目名（如「网络代理」）。
 * @param ready 该页独有的元素，用来确认页面已经切过去并完成初始化。
 */
export async function switchSettingsSection(page: Page, section: string, ready: Locator): Promise<void> {
    // 面包屑里也会出现当前栏目的同名链接，这里限定在侧边栏内点击，避免歧义
    await page.locator('aside').getByRole('link', { name: section }).click();
    await expect(ready).toBeVisible();
}

/**
 * 重新加载当前设置页，用于验证界面上的值确实来自后端回读。
 *
 * 应用用 HashRouter，刷新会停在同一个设置页；重载等同于用户重新进入该页，
 * 但能排除「值只活在页面 state 里」的假通过。
 *
 * @param page 应用主窗口页面。
 * @param ready 该页的标志性元素，重载后重新等待它出现。
 */
export async function reloadSettingsPage(page: Page, ready: Locator): Promise<void> {
    await page.reload();
    await expect(ready).toBeVisible();
}

/**
 * 定位某个设置行里的下拉框。
 *
 * 同一页常有多个 Select（服务与资源页有 5 个），按该行独有的文案缩小范围，
 * 避免用例因为 Select 的排列顺序变化而串台。传入该行标题或说明的独有片段即可。
 *
 * @param page 应用主窗口页面。
 * @param rowText 该行独有的文案片段。
 * @returns 该行内的下拉框触发器。
 */
export function selectInRow(page: Page, rowText: string): Locator {
    return page
        .locator('div')
        .filter({ hasText: rowText })
        .filter({ has: page.getByRole('combobox') })
        .last()
        .getByRole('combobox');
}

/**
 * 在某个设置行内点开下拉框并选中一项。
 *
 * @param page 应用主窗口页面。
 * @param rowText 该行独有的文案片段。
 * @param option 下拉项的中文文案。
 */
export async function chooseInRow(page: Page, rowText: string, option: string): Promise<void> {
    await selectInRow(page, rowText).click();
    await page.getByRole('option', { name: option }).click();
}
