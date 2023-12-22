import React, { useEffect } from 'react';
import './App.css';
import '../../../common/fonts/Archivo-VariableFont_wdth,wght.ttf';
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
import TieleBarLayout from './pages/TieleBarLayout';
import Background from '../../components/bg/Background';

loader.config({ monaco });
LicenseManager.prototype.validateLicense = () => {};
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
            <div className="w-full h-screen font-face-arc text-black overflow-hidden select-none">
                <HashRouter>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="home" element={<HomePage />} />
                        <Route element={<TieleBarLayout />}>
                            <Route
                                path="player/:videoId"
                                element={<PlayerP />}
                            />
                            <Route path="*" element={<Layout />}>
                                <Route
                                    path="word-management"
                                    element={<WordManagement />}
                                />
                            </Route>
                        </Route>
                        <Route path="bg" element={<Background />} />
                    </Routes>
                </HashRouter>
            </div>
        </FileDrop>
    );
}
