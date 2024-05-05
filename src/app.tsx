import {createRoot} from 'react-dom/client';
import React, {useEffect} from 'react';
import useSetting from '@/fronted/hooks/useSetting';
import {HashRouter, Route, Routes} from "react-router-dom";
import HomePage from "@/fronted/pages/HomePage";
import TitleBarLayout from "@/fronted/pages/TieleBarLayout";
import PlayerP from "@/fronted/pages/PlayerP";
import Layout from "@/fronted/pages/Layout";
import About from "@/fronted/pages/About";
import SettingLayout from "@/fronted/pages/setting/SettingLayout";
import ShortcutSetting from "@/fronted/pages/setting/ShortcutSetting";
import YouDaoSetting from "@/fronted/pages/setting/YouDaoSetting";
import TenantSetting from "@/fronted/pages/setting/TenantSetting";
import StorageSetting from "@/fronted/pages/setting/StorageSetting";
import CheckUpdate from "@/fronted/pages/setting/CheckUpdate";
import AppearanceSetting from "@/fronted/pages/setting/AppearanceSetting";
import {Toaster} from "@/fronted/components/ui/sonner";
import toast, {Toaster as HotToaster} from "react-hot-toast";

import {syncStatus} from "@/fronted/hooks/useSystem";
import Transcript from '@/fronted/pages/transcript/Transcript';
import OpenAiSetting from '@/fronted/pages/setting/OpenAiSetting';
import Split from '@/fronted/pages/split/Split';
import GlobalShortCut from "@/fronted/components/short-cut/GlobalShortCut";
import DownloadVideo from "@/fronted/pages/DownloadVideo";
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
            <div className='w-full h-screen text-black overflow-hidden select-none font-sans'>
                <HashRouter>
                    <Routes>
                        <Route path='/' element={<HomePage/>}/>
                        <Route path='home' element={<HomePage/>}/>
                        <Route element={<TitleBarLayout/>}>
                            <Route
                                path='player/:videoId'
                                element={<PlayerP/>}
                            />
                            <Route path='*' element={<Layout/>}>
                                <Route
                                    path='transcript'
                                    element={<Transcript/>}
                                />
                                <Route
                                    path='split'
                                    element={<Split/>}
                                />
                                <Route
                                    path='download'
                                    element={<DownloadVideo/>}
                                />
                                <Route path='about' element={<About/>}/>
                                <Route
                                    path='settings'
                                    element={<SettingLayout/>}
                                >
                                    <Route
                                        path='*'
                                        element={<ShortcutSetting/>}
                                    />
                                    <Route
                                        path='shortcut'
                                        element={<ShortcutSetting/>}
                                    />
                                    <Route
                                        path='you-dao'
                                        element={<YouDaoSetting/>}
                                    />
                                    <Route
                                        path='tenant'
                                        element={<TenantSetting/>}
                                    />
                                    <Route
                                        path='open-ai'
                                        element={<OpenAiSetting/>}
                                    />
                                    <Route
                                        path='storage'
                                        element={<StorageSetting/>}
                                    />
                                    <Route
                                        path='update'
                                        element={<CheckUpdate/>}
                                    />
                                    <Route
                                        path='appearance'
                                        element={<AppearanceSetting/>}
                                    />
                                </Route>
                            </Route>
                        </Route>
                    </Routes>
                </HashRouter>
            </div>
            <Toaster position="bottom-left"/>
            <HotToaster/>
            <GlobalShortCut/>
        </>
    );
}

const root = createRoot(document.body);
root.render(<App/>);
syncStatus();
api.onErrorMsg((error: Error) => {
    toast.error(error.message);
});
