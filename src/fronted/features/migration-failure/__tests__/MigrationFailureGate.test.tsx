import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrationFailureGate } from '../MigrationFailureGate';
import {
    resetAndRelaunch,
    retryAfterMigrationFailure,
} from '../migrationFailureApi';
import type { MigrationFailureDetail } from '@/common/contracts/migration-failure';

vi.mock('../migrationFailureApi', () => ({
    getMigrationFailureDetail: vi.fn(),
    retryAfterMigrationFailure: vi.fn(),
    resetAndRelaunch: vi.fn(),
}));

vi.mock('@/fronted/components/layout/TitleBar/TitleBar', () => ({
    default: () => <div data-testid="title-bar" />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

/** 构造一次 drizzle 阶段的迁移失败详情。 */
const failureDetail = (overrides: Partial<MigrationFailureDetail> = {}): MigrationFailureDetail => ({
    failed: true,
    phase: 'custom',
    migrationId: 'store-schema-dictionary-youdao-v2',
    description: '清理有道词典链路存量数据',
    errorMessage: 'SQLITE_BUSY: database is locked',
    ...overrides,
});

describe('MigrationFailureGate 恢复页', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(retryAfterMigrationFailure).mockResolvedValue();
        vi.mocked(resetAndRelaunch).mockResolvedValue();
    });

    it('展示失败阶段、迁移身份与错误详情', () => {
        render(<MigrationFailureGate failure={failureDetail()} />);

        expect(screen.getByText('title')).toBeDefined();
        expect(screen.getByText(/store-schema-dictionary-youdao-v2/)).toBeDefined();
        expect(screen.getByText(/SQLITE_BUSY/)).toBeDefined();
    });

    it('drizzle 阶段失败时展示阶段标识，没有迁移 id', () => {
        render(<MigrationFailureGate failure={failureDetail({
            phase: 'drizzle',
            migrationId: null,
            description: null,
        })} />);

        expect(screen.getByText(/phase: drizzle/)).toBeDefined();
    });

    it('点击重试会调用重启接口，并停留在重启中状态', async () => {
        vi.mocked(retryAfterMigrationFailure).mockImplementation(() => new Promise(() => {}));
        render(<MigrationFailureGate failure={failureDetail()} />);

        fireEvent.click(screen.getByText('retry'));

        await waitFor(() => {
            expect(retryAfterMigrationFailure).toHaveBeenCalledTimes(1);
        });
        expect(screen.getByText('retrying')).toBeDefined();
    });

    it('重置需要先在确认弹窗中点击确认，才会执行重置', async () => {
        render(<MigrationFailureGate failure={failureDetail()} />);

        fireEvent.click(screen.getByText('reset'));
        // 确认弹窗出现前不触发重置
        expect(resetAndRelaunch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('resetConfirmOk'));

        await waitFor(() => {
            expect(resetAndRelaunch).toHaveBeenCalledTimes(1);
        });
        expect(screen.getByText('resetting')).toBeDefined();
    });

    it('重置失败（如文件被占用）时把错误展示在页面上，可以再次操作', async () => {
        vi.mocked(resetAndRelaunch).mockRejectedValue(new Error('EBUSY: resource busy'));
        render(<MigrationFailureGate failure={failureDetail()} />);

        fireEvent.click(screen.getByText('reset'));
        fireEvent.click(screen.getByText('resetConfirmOk'));

        await waitFor(() => {
            expect(screen.getByText(/EBUSY: resource busy/)).toBeDefined();
        });
        // 失败后按钮恢复可用，用户处理后可重试
        expect(screen.getByText('reset')).toBeDefined();
    });
});
