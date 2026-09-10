import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { App } from '../app';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/fronted/i18n', () => ({
    applyLanguageSetting: vi.fn().mockResolvedValue(undefined),
}));

/** 后端 IPC 调用替身；测试按路径指定启动门槛的返回值。 */
const electronCall = window.electron.call as unknown as ReturnType<typeof vi.fn>;

/** 按路径给启动门槛用到的 IPC 调用配置返回值。 */
function stubStartupState(options: {
    /** system/config/get 的返回值，代表引导完成版本。 */
    onboardingCompletedVersion: string | null;
    /** 迁移是否失败。 */
    migrationFailed: boolean;
}): void {
    electronCall.mockImplementation((path: string) => {
        if (path === 'system/config/get') {
            return Promise.resolve(options.onboardingCompletedVersion);
        }
        if (path === 'migration-failure/detail') {
            return Promise.resolve(
                options.migrationFailed
                    ? {
                          failed: true,
                          phase: 'custom',
                          migrationId: 'store-schema-dictionary-youdao-v2',
                          description: '清理有道词典链路存量数据',
                          errorMessage: 'SQLITE_BUSY: database is locked',
                      }
                    : { failed: false, phase: null, migrationId: null, description: null, errorMessage: null }
            );
        }
        if (path === 'watch-history/list/basic') {
            return Promise.resolve([]);
        }
        return Promise.resolve({});
    });
}

describe('应用启动门槛', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('从未完成过引导时，启动进入首次使用引导页', async () => {
        stubStartupState({ onboardingCompletedVersion: null, migrationFailed: false });

        render(<App />);

        expect(await screen.findByText('steps.storage.heroTitle')).toBeDefined();
    });

    it('已完成过引导时，启动直接进入主界面', async () => {
        stubStartupState({ onboardingCompletedVersion: '1', migrationFailed: false });

        render(<App />);

        expect(await screen.findByText('DashPlayer')).toBeDefined();
        expect(screen.queryByText('steps.storage.heroTitle')).toBeNull();
    });

    it('迁移失败时优先进入启动恢复页，不再进入引导页', async () => {
        stubStartupState({ onboardingCompletedVersion: null, migrationFailed: true });

        render(<App />);

        expect(await screen.findByText(/SQLITE_BUSY/)).toBeDefined();
        expect(screen.queryByText('steps.storage.heroTitle')).toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('启动门槛尚未判定完成时展示加载指示，不留白屏', () => {
        // 两个门槛都挂着不返回，模拟判定尚未完成
        electronCall.mockImplementation(() => new Promise(() => undefined));

        render(<App />);

        expect(screen.getByRole('status')).toBeDefined();
        expect(screen.getByText('loading')).toBeDefined();
    });
});
