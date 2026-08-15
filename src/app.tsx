import { createRoot } from 'react-dom/client';
import React, { useEffect } from 'react';
import useSetting from '@/fronted/features/settings/settingsStore';
import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from '@/fronted/features/file-browser/HomePage';
import TitleBarLayout from '@/fronted/pages/TieleBarLayout';
import PlayerPage from '@/fronted/features/player/PlayerPage';
import Layout from '@/fronted/pages/Layout';
import About from '@/fronted/pages/About';
import SettingLayout from '@/fronted/features/settings/SettingLayout';
import ShortcutSetting from '@/fronted/features/settings/ShortcutSetting';
import StorageSetting from '@/fronted/features/settings/StorageSetting';
import CheckUpdate from '@/fronted/features/settings/CheckUpdate';
import AppearanceSetting from '@/fronted/features/settings/AppearanceSetting';
import ProxySetting from '@/fronted/features/settings/ProxySetting';
import ServiceCredentialSetting from '@/fronted/features/settings/ServiceCredentialSetting';
import EngineSelectionSetting from '@/fronted/features/settings/EngineSelectionSetting';
import { Toaster } from '@/fronted/components/ui/sonner';
import { Toaster as HotToaster } from 'react-hot-toast';
import RendererToastHost from '@/fronted/components/shared/toasts/RendererToastHost';

import TranscriptPage from '@/fronted/features/transcript/TranscriptPage';
import SplitPage from '@/fronted/features/split/SplitPage';
import GlobalShortCut from '@/fronted/components/shared/shortcuts/GlobalShortCut';
import ConvertPage from '@/fronted/features/convert/ConvertPage';
import Eb from '@/fronted/components/shared/common/Eb';
import FavouritePage from '@/fronted/features/favourite/FavouritePage';
import VideoLearningPage from '@/fronted/features/video-learning/VideoLearningPage';
import { toast as sonnerToast } from 'sonner';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { applyLanguageSetting } from '@/fronted/i18n';

const UPDATE_CHECK_DELAY_MS = 6000;
const UPDATE_TOAST_ID = 'update-available';
const App = () => {
    const { t } = useI18nTranslation('toast');
    const theme = useSetting((s) => s.values.get('appearance.theme'));
    const languageSetting = useSetting((s) => s.values.get('i18n.language'));
    useEffect(() => {
        document.documentElement.classList.add(theme ?? 'dark');
        return () => {
            document.documentElement.classList.remove(theme ?? 'dark');
        };
    }, [theme]);

    useEffect(() => {
        applyLanguageSetting(languageSetting).catch(() => undefined);
    }, [languageSetting]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            (async () => {
                const result = await backendClient.call('system/check-update', { mode: 'toast' });
                if (result.status !== 'ok' || result.releases.length === 0 || !result.shouldNotify) {
                    return;
                }
                const latest = result.releases[0];
                sonnerToast(t('updateAvailableTitle', { version: latest.version }), {
                    id: UPDATE_TOAST_ID,
                    duration: 8000,
                    position: 'bottom-left',
                    action: {
                        label: t('updateAvailableAction'),
                        onClick: async () => {
                            await backendClient.call('system/open-url', latest.url);
                        },
                    },
                });
            })().catch(() => {
                // ignore update check failures on startup
            });
        }, UPDATE_CHECK_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [t]);
    return (
        <>
            <div className="w-full h-screen text-black overflow-hidden select-none font-sans">
                <HashRouter>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="home" element={<HomePage />} />
                        <Route element={<TitleBarLayout />}>
                            <Route
                                path="player/:videoId"
                                element={<PlayerPage />}
                            />
                            <Route path="*" element={<Layout />}>
                                <Route
                                    path="transcript"
                                    element={<Eb key="transcript"><TranscriptPage /></Eb>}
                                />
                                <Route
                                    path="favorite"
                                    element={<Eb key="favorite"><FavouritePage /></Eb>}
                                />
                                <Route
                                    path="split"
                                    element={<Eb key="split"><SplitPage /></Eb>}
                                />
                                <Route
                                    path="convert"
                                    element={<Eb key="convert"><ConvertPage /></Eb>}
                                />
                                <Route
                                    path="vocabulary"
                                    element={<Eb key="vocabulary"><VideoLearningPage /></Eb>}
                                />
                                <Route path="about" element={<Eb key="about"><About /></Eb>} />
                                <Route
                                    path="settings"
                                    element={<SettingLayout />}
                                >
                                    <Route
                                        path="*"
                                        element={<Eb><ShortcutSetting /></Eb>}
                                    />
                                    <Route
                                        path="shortcut"
                                        element={<Eb><ShortcutSetting /></Eb>}
                                    />
                                    <Route
                                        path="service-credentials"
                                        element={<Eb><ServiceCredentialSetting /></Eb>}
                                    />
                                    <Route
                                        path="engine-selection"
                                        element={<Eb><EngineSelectionSetting /></Eb>}
                                    />
                                    <Route
                                        path="storage"
                                        element={<Eb><StorageSetting /></Eb>}
                                    />
                                    <Route
                                        path="update"
                                        element={<Eb><CheckUpdate /></Eb>}
                                    />
                                    <Route
                                        path="appearance"
                                        element={<Eb><AppearanceSetting /></Eb>}
                                    />
                                    <Route
                                        path="proxy"
                                        element={<Eb><ProxySetting /></Eb>}
                                    />
                                </Route>
                            </Route>
                        </Route>
                    </Routes>
                </HashRouter>
            </div>
            <Toaster position="bottom-left" />
            <HotToaster />
            <RendererToastHost />
            <GlobalShortCut />
        </>
    );
};

/**
 * 将 React 应用挂载到 renderer 页面根节点。
 *
 * @throws 页面缺少 root 节点时抛出错误，避免应用在不完整的 HTML 中静默启动。
 */
export function mountApp(): void {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error('Root element not found');
    }
    const root = createRoot(rootElement);
    root.render(<App />);
}
