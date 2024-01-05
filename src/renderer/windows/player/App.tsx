import React, { useEffect } from 'react';
import './App.css';
import 'tailwindcss/tailwind.css';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { LicenseManager } from 'ag-grid-enterprise';
import HomePage from './pages/HomePage';
import FileDrop from '../../components/FileDrop';
import useSetting from '../../hooks/useSetting';
import Layout from './pages/Layout';
import { PlayerP, WordManagement } from './pages';
import TitleBarLayout from './pages/TieleBarLayout';
import ShortcutSetting from './pages/setting/ShortcutSetting';
import YouDaoSetting from './pages/setting/YouDaoSetting';
import TenantSetting from './pages/setting/TenantSetting';
import StorageSetting from './pages/setting/StorageSetting';
import CheckUpdate from './pages/setting/CheckUpdate';
import AppearanceSetting from './pages/setting/AppearanceSetting';
import SettingLayout from './pages/setting/SettingLayout';
import About from './pages/About';
import toast, { Toaster } from 'react-hot-toast';

loader.config({ monaco });
LicenseManager.prototype.validateLicense = () => {
};
LicenseManager.prototype.isDisplayWatermark = () => {
    return false;
};
export default function App() {
    const [isDragging, setIsDragging] = React.useState<boolean>(false);
    const theme = useSetting((s) => s.values.get('appearance.theme'));
    useEffect(() => {
        document.documentElement.classList.add(theme ?? 'dark');
        return () => {
            document.documentElement.classList.remove(theme ?? 'dark');
        };
    }, [theme]);
    return (
        <FileDrop isDragging={isDragging} setIsDragging={setIsDragging}>
            <>
                <div className='w-full h-screen text-black overflow-hidden select-none font-sans'>
                    <HashRouter>
                        <Routes>
                            <Route path='/' element={<HomePage />} />
                            <Route path='home' element={<HomePage />} />
                            <Route element={<TitleBarLayout />}>
                                <Route
                                    path='player/:videoId'
                                    element={<PlayerP />}
                                />
                                <Route path='*' element={<Layout />}>
                                    <Route
                                        path='word-management'
                                        element={<WordManagement />}
                                    />
                                    <Route path='about' element={<About />} />
                                    <Route
                                        path='settings'
                                        element={<SettingLayout />}
                                    >
                                        <Route
                                            path='*'
                                            element={<ShortcutSetting />}
                                        />
                                        <Route
                                            path='shortcut'
                                            element={<ShortcutSetting />}
                                        />
                                        <Route
                                            path='you-dao'
                                            element={<YouDaoSetting />}
                                        />
                                        <Route
                                            path='tenant'
                                            element={<TenantSetting />}
                                        />
                                        <Route
                                            path='storage'
                                            element={<StorageSetting />}
                                        />
                                        <Route
                                            path='update'
                                            element={<CheckUpdate />}
                                        />
                                        <Route
                                            path='appearance'
                                            element={<AppearanceSetting />}
                                        />
                                    </Route>
                                </Route>
                            </Route>
                        </Routes>
                    </HashRouter>
                </div>
                <Toaster />
            </>
        </FileDrop>
    );
}
