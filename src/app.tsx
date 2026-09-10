import { createRoot } from 'react-dom/client';
import React, { useEffect } from 'react';
import useSetting from '@/fronted/features/settings/settingsStore';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from '@/fronted/features/file-browser/HomePage';
import TitleBarLayout from '@/fronted/pages/TieleBarLayout';
import PlayerPage from '@/fronted/features/player/PlayerPage';
import Layout from '@/fronted/pages/Layout';
import SettingLayout from '@/fronted/features/settings/SettingLayout';
import ShortcutSetting from '@/fronted/features/settings/ShortcutSetting';
import StorageSetting from '@/fronted/features/settings/StorageSetting';
import AboutSetting from '@/fronted/features/settings/AboutSetting';
import AppearanceSetting from '@/fronted/features/settings/AppearanceSetting';
import ProxySetting from '@/fronted/features/settings/ProxySetting';
import ServiceResourceSetting from '@/fronted/features/settings/ServiceResourceSetting';
import toast, { Toaster as HotToaster, Toast } from 'react-hot-toast';
import RendererToastHost from '@/fronted/components/shared/toasts/RendererToastHost';

import TranscriptPage from '@/fronted/features/transcript/TranscriptPage';
import SplitPage from '@/fronted/features/split/SplitPage';
import GlobalShortCut from '@/fronted/components/shared/shortcuts/GlobalShortCut';
import RepairPage from '@/fronted/features/repair/RepairPage';
import Eb from '@/fronted/components/shared/common/Eb';
import FavouritePage from '@/fronted/features/favourite/FavouritePage';
import VideoLearningPage from '@/fronted/features/video-learning/VideoLearningPage';
import { OnboardingView } from '@/fronted/features/onboarding/OnboardingView';
import { getOnboardingCompletedVersion } from '@/fronted/features/onboarding/onboardingApi';
import { MigrationFailureGate } from '@/fronted/features/migration-failure/MigrationFailureGate';
import { getMigrationFailureDetail } from '@/fronted/features/migration-failure/migrationFailureApi';
import type { MigrationFailureDetail } from '@/common/contracts/migration-failure';
import { Button } from '@/fronted/components/ui/button';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { applyLanguageSetting } from '@/fronted/i18n';

const UPDATE_CHECK_DELAY_MS = 6000;
const UPDATE_TOAST_ID = 'update-available';

/**
 * 启动门槛的判定结果，优先级从高到低：迁移失败 → 首次使用引导 → 主界面。
 *
 * null 表示尚未判定完成：此时只展示轻量加载态，避免主界面先闪一下再被引导页顶掉。
 */
type StartupGate =
    | { kind: 'migration-failure'; failure: MigrationFailureDetail }
    | { kind: 'onboarding' }
    | { kind: 'main' };

/**
 * 启动门槛判定期间的过渡态。
 *
 * 判定只等一轮 IPC 往返，但主界面挂载很重（首页会立即拉列表、改窗口尺寸），
 * 所以这里只给一个轻量加载指示：既不先渲染主界面再切走，也不留一片空白。
 */
const StartupLoading: React.FC = () => {
    const { t } = useI18nTranslation('common');
    return (
        <div
            role="status"
            className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground"
        >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">{t('loading')}</span>
        </div>
    );
};

export const App = () => {
    const { t } = useI18nTranslation('toast');
    const theme = useSetting((s) => s.values.get('appearance.theme'));
    const languageSetting = useSetting((s) => s.values.get('i18n.language'));
    /** 当前生效的启动门槛；null 表示两个门槛都还没读出结果。 */
    const [gate, setGate] = React.useState<StartupGate | null>(null);

    // 两个门槛并行读取、统一裁决，避免各自为政时互相覆盖；
    // 单次读取失败按「该门槛不拦截」处理，否则一次 IPC 异常就会把用户永久锁在启动页。
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [failure, completedVersion] = await Promise.all([
                getMigrationFailureDetail().catch(() => null),
                getOnboardingCompletedVersion().catch(() => null),
            ]);
            if (cancelled) {
                return;
            }
            if (failure?.failed) {
                setGate({ kind: 'migration-failure', failure });
                return;
            }
            setGate(completedVersion ? { kind: 'main' } : { kind: 'onboarding' });
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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
                const versionTitle = t('updateAvailableTitle', { version: latest.version });
                toast(
                    (tState: Toast) => (
                        <div className="flex items-center gap-3 text-sm">
                            <span className="font-semibold text-xs">{versionTitle}</span>
                            <Button
                                size="sm"
                                className="h-7 px-3 text-xs shrink-0"
                                onClick={() => {
                                    toast.dismiss(tState.id);
                                    void backendClient.call('system/open-url', latest.url);
                                }}
                            >
                                {t('updateAvailableAction')}
                            </Button>
                        </div>
                    ),
                    {
                        id: UPDATE_TOAST_ID,
                        duration: 8000,
                    }
                );
            })().catch(() => {
                // ignore update check failures on startup
            });
        }, UPDATE_CHECK_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [t]);
    return (
        <>
            <div className="w-full h-screen text-black overflow-hidden select-none font-sans">
                {gate?.kind === 'migration-failure' && (
                    <MigrationFailureGate failure={gate.failure} />
                )}
                {gate?.kind === 'onboarding' && (
                    <OnboardingView onCompleted={() => setGate({ kind: 'main' })} />
                )}
                {gate?.kind === 'main' && (
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
                                        path="repair"
                                        element={<Eb key="repair"><RepairPage /></Eb>}
                                    />
                                    <Route
                                        path="vocabulary"
                                        element={<Eb key="vocabulary"><VideoLearningPage /></Eb>}
                                    />
                                    <Route path="about" element={<Navigate to="/settings/about" replace />} />
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
                                            path="resources"
                                            element={<Eb><ServiceResourceSetting /></Eb>}
                                        />
                                        <Route
                                            path="storage"
                                            element={<Eb><StorageSetting /></Eb>}
                                        />
                                        <Route
                                            path="update"
                                            element={<Navigate to="/settings/about" replace />}
                                        />
                                        <Route
                                            path="about"
                                            element={<Eb><AboutSetting /></Eb>}
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
                )}
                {gate === null && <StartupLoading />}
            </div>
            <HotToaster
                position="top-center"
                toastOptions={{
                    className: 'border border-border/80 bg-background/95 text-foreground shadow-lg backdrop-blur-md text-xs font-medium rounded-xl',
                    style: {
                        background: 'hsl(var(--background))',
                        color: 'hsl(var(--foreground))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    },
                }}
            />
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
