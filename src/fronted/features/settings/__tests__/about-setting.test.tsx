import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import '@/fronted/i18n';
import AboutSetting from '../AboutSetting';
import { settingsApi } from '../settingsApi';

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
        expect(await screen.findByText("You're up to date")).toBeDefined();
        expect(screen.getByRole('button', { name: /Check for Updates/ })).toBeDefined();
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

        expect(await screen.findByText('Download New Release')).toBeDefined();
        expect(screen.getAllByText(/v0.16.0/).length).toBeGreaterThan(0);
    });
});
