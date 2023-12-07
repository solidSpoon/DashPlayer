import React, { useEffect } from 'react';
import './App.css';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from '../../components/HomePage';
import FileDrop from '../../components/FileDrop';
import useSetting from '../../hooks/useSetting';
import Layout from './pages/Layout';
import { PlayerP, WordManagement } from './pages';
import TieleBarLayout from './pages/TieleBarLayout';

loader.config({ monaco });
export const api = window.electron;
import { LicenseManager } from 'ag-grid-enterprise';

LicenseManager.prototype.validateLicense = () => {
};
LicenseManager.prototype.isDisplayWatermark = () => {
    return false;
};
export default function App() {
    const [isDragging, setIsDragging] = React.useState<boolean>(false);
    const theme = useSetting((s) => s.appearance.theme);
    useEffect(() => {
        document.documentElement.classList.add(theme);
        return () => {
            document.documentElement.classList.remove(theme);
        };
    }, [theme]);
    return (
        <FileDrop isDragging={isDragging} setIsDragging={setIsDragging}>
            <div className='w-full h-screen font-face-arc text-black overflow-hidden select-none'>
                <HashRouter>
                    <Routes>
                        <Route path='/' element={<HomePage />} />
                        <Route path='home' element={<HomePage />} />
                        <Route path='/' element={<TieleBarLayout />}>
                            <Route
                                path='player/:videoId'
                                element={<PlayerP />}
                            />
                            <Route path='*' element={<Layout />}>
                                <Route
                                    path='word-management'
                                    element={<WordManagement />}
                                />
                            </Route>
                        </Route>
                    </Routes>
                </HashRouter>
            </div>
        </FileDrop>
    );
}
