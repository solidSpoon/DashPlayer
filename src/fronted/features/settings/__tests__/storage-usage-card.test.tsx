import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import StorageUsageCard from '@/fronted/features/settings/components/StorageUsageCard';
import { StorageUsageVO } from '@/common/contracts/storage-usage-vo';

const mockUsage: StorageUsageVO = {
    totalBytes: 1024 * 1024 * 100, // 100 MB
    items: [
        { category: 'videos', bytes: 1024 * 1024 * 60 },
        { category: 'word_clips', bytes: 1024 * 1024 * 20 },
        { category: 'models', bytes: 1024 * 1024 * 10 },
        { category: 'temp', bytes: 1024 * 1024 * 5 },
        { category: 'favorite_clips', bytes: 1024 * 1024 * 5 },
        { category: 'other', bytes: 0 },
    ],
};

beforeAll(() => {
    // 模拟 recharts ResponsiveContainer
    global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
});

afterEach(() => {
    cleanup();
});

describe('StorageUsageCard', () => {
    it('处于 loading 且 usage 为 null 时，应展示骨架屏', () => {
        render(
            <StorageUsageCard
                usage={null}
                loading={true}
                onRefresh={vi.fn()}
            />
        );

        expect(screen.getByTestId('storage-usage-skeleton')).toBeInTheDocument();
    });

    it('加载完成并具有用量数据时，展示用量明细', () => {
        render(
            <StorageUsageCard
                usage={mockUsage}
                loading={false}
                onRefresh={vi.fn()}
            />
        );

        expect(screen.queryByTestId('storage-usage-skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('100.00 MB')).toBeInTheDocument();
        expect(screen.getByText('60.00 MB')).toBeInTheDocument();
        expect(screen.getByText('60.0%')).toBeInTheDocument();
    });

    it('未加载但数据为空 (totalBytes=0) 时，展示空状态提示', () => {
        const emptyUsage: StorageUsageVO = {
            totalBytes: 0,
            items: [],
        };

        render(
            <StorageUsageCard
                usage={emptyUsage}
                loading={false}
                onRefresh={vi.fn()}
            />
        );

        expect(screen.getByText('storage.usage.empty')).toBeInTheDocument();
    });
});
