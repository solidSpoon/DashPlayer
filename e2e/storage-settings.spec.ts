import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { readConfigValue, test } from './fixtures';
import { openSettingsSection, reloadSettingsPage } from './settings-page';

/** 进入存储管理设置页。 */
async function openStorageSetting(page: Page): Promise<void> {
    await openSettingsSection(page, '存储', page.getByRole('heading', { name: '存储管理' }));
}

test.describe('存储设置', () => {
    test('[SET-STO-01] 改完媒体库路径后落盘，重进页面仍回显', async ({ session, userDataDir }) => {
        const page = session.page;
        await openStorageSetting(page);

        const libraryInput = page.getByPlaceholder('Documents/DashPlayer');
        // 用例独占目录里的媒体库路径由 fixture 预置，先确认界面回显的就是它
        const initialPath = path.join(userDataDir, 'library');
        await expect(libraryInput).toHaveValue(initialPath);

        // 先把目录建好，避免用例依赖后端对不存在目录的按需创建行为
        const nextPath = path.join(userDataDir, 'library-e2e');
        fs.mkdirSync(nextPath, { recursive: true });

        await libraryInput.fill(nextPath);

        await expect.poll(() => readConfigValue(userDataDir, 'storage.path')).toBe(nextPath);

        // 重进页面：路径来自后端回读，而不是页面里残留的输入
        await reloadSettingsPage(page, page.getByRole('heading', { name: '存储管理' }));
        await expect(page.getByPlaceholder('Documents/DashPlayer')).toHaveValue(nextPath);
    });

    test('[SET-STO-02] 填了没有写权限的目录会显式报错，不落盘也不在页面上假装已保存', async ({ session, userDataDir }) => {
        const page = session.page;
        await openStorageSetting(page);

        const libraryInput = page.getByPlaceholder('Documents/DashPlayer');
        const initialPath = path.join(userDataDir, 'library');
        await expect(libraryInput).toHaveValue(initialPath);

        // 造一个用户确实可能选到的坏路径：父目录存在但没有写权限
        const readOnlyParent = path.join(userDataDir, 'read-only-parent');
        fs.mkdirSync(readOnlyParent);
        fs.chmodSync(readOnlyParent, 0o500);
        await libraryInput.fill(path.join(readOnlyParent, 'library'));

        // 保存失败必须让用户看见原因，否则就是「页面上填了、实际没保存」的静默失败
        const saveError = page.getByRole('alert');
        await expect(saveError).toBeVisible();
        await expect(saveError).toContainText('当前存储目录暂时无法访问');
        expect(readConfigValue(userDataDir, 'storage.path')).toBe(initialPath);

        // 重进页面：界面回显的是真正存下来的旧路径，而不是刚才那段无效输入
        await reloadSettingsPage(page, page.getByRole('heading', { name: '存储管理' }));
        await expect(page.getByPlaceholder('Documents/DashPlayer')).toHaveValue(initialPath);
    });
});
