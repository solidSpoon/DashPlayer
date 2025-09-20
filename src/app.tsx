import { createRoot } from 'react-dom/client';
import React, { useEffect } from 'react';
import useSetting from '@/fronted/hooks/useSetting';
import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from '@/fronted/pages/HomePage';
import TitleBarLayout from '@/fronted/pages/TieleBarLayout';
import PlayerWithControlsPage from '@/fronted/pages/player/PlayerWithControlsPage';
import Layout from '@/fronted/pages/Layout';
import About from '@/fronted/pages/About';
import SettingLayout from '@/fronted/pages/setting/SettingLayout';
import ShortcutSetting from '@/fronted/pages/setting/ShortcutSetting';
import StorageSetting from '@/fronted/pages/setting/StorageSetting';
import CheckUpdate from '@/fronted/pages/setting/CheckUpdate';
import AppearanceSetting from '@/fronted/pages/setting/AppearanceSetting';
import ServiceManagementSetting from '@/fronted/pages/setting/ServiceManagementSetting';
import { Toaster } from '@/fronted/components/ui/sonner';
import toast, { Toaster as HotToaster } from 'react-hot-toast';

import { syncStatus } from '@/fronted/hooks/useSystem';
import Transcript from '@/fronted/pages/transcript/Transcript';
import Split from '@/fronted/pages/split/Split';
import GlobalShortCut from '@/fronted/components/short-cut/GlobalShortCut';
import DownloadVideo from '@/fronted/pages/DownloadVideo';
import Convert from '@/fronted/pages/convert/Convert';
import Eb from '@/fronted/components/common/Eb';
import Favorite from '@/fronted/pages/favourite';
import VideoLearningPage from '@/fronted/pages/video-learning';
import {startListeningToDpTasks} from "@/fronted/hooks/useDpTaskCenter";

const api = window.electron;
const App = () => {
    const theme = useSetting((s) => s.values.get('appearance.theme'));
    useEffect(() => {
        document.documentElement.classList.add(theme ?? 'dark');
        return () => {
            document.documentElement.classList.remove(theme ?? 'dark');
        };
    }, [theme]);
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
                                element={<PlayerWithControlsPage />}
                            />
                            <Route path="*" element={<Layout />}>
                                <Route
                                    path="transcript"
                                    element={<Eb key="transcript"><Transcript /></Eb>}
                                />
                                <Route
                                path="favorite"
                                element={<Eb key="favorite"><Favorite /></Eb>}
                                />
                                <Route
                                    path="split"
                                    element={<Eb key="split"><Split /></Eb>}
                                />
                                <Route
                                    path="download"
                                    element={<Eb key="download"><DownloadVideo /></Eb>}
                                />
                                <Route
                                    path="convert"
                                    element={<Eb key="convert"><Convert /></Eb>}
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
                                        path="services"
                                        element={<Eb><ServiceManagementSetting /></Eb>}
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
                                </Route>
                            </Route>
                        </Route>
                    </Routes>
                </HashRouter>
            </div>
            <Toaster position="bottom-left" />
            <HotToaster />
            <GlobalShortCut />
        </>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}
const root = createRoot(rootElement);
root.render(<App />);
syncStatus();
api.onErrorMsg((error: Error) => {
    toast.error(error.message);
});
api.onInfoMsg((info: string) => {
    toast.success(info);
});
startListeningToDpTasks();
