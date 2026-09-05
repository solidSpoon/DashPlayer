import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import AboutSetting from '../AboutSetting';
import { settingsApi } from '../settingsApi';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) => {
            if (options?.defaultValue) {
                return typeof options.defaultValue === 'string' && options?.version
                    ? options.defaultValue.replace('{{version}}', options.version)
                    : options.defaultValue;
            }
            return key;
        },
    }),
}));

vi.mock('../settingsStore', () => ({
    default: (selector: any) => selector({ values: new Map([['appearance.theme', 'dark']]) }),
}));

vi.mock('../settingsApi', () => ({
    settingsApi: {
        getAppVersion: vi.fn(),
        checkUpdate: vi.fn(),
        openUrl: vi.fn(),
    },
}));

const renderWithFreshSWR = (ui: React.ReactElement) => {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            {ui}
        </SWRConfig>
    );
};

describe('AboutSetting', () => {
    it('renders app title and checks for updates in up-to-date state', async () => {
        vi.mocked(settingsApi.getAppVersion).mockResolvedValue('0.15.2');
        vi.mocked(settingsApi.checkUpdate).mockResolvedValue({
            status: 'ok',
            releases: [],
        });

        renderWithFreshSWR(<AboutSetting />);

        expect(screen.getByText('DashPlayer')).toBeDefined();
        expect(await screen.findByText('当前已是最新版本')).toBeDefined();
        expect(screen.getByRole('button', { name: /检查更新/ })).toBeDefined();
    });

    it('renders release changelog when a newer version is available', async () => {
        vi.mocked(settingsApi.getAppVersion).mockResolvedValue('0.15.2');
        vi.mocked(settingsApi.checkUpdate).mockResolvedValue({
            status: 'ok',
            releases: [
                {
                    version: 'v0.16.0',
                    content: 'Added new features and bug fixes',
                    url: 'https://github.com/solidSpoon/DashPlayer/releases/tag/v0.16.0',
                },
            ],
        });

        renderWithFreshSWR(<AboutSetting />);

        expect(await screen.findByText('前往下载新版本')).toBeDefined();
        expect(screen.getAllByText(/v0.16.0/).length).toBeGreaterThan(0);
    });
});
