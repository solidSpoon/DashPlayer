import React, { useEffect } from 'react';
import './App.css';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from 'framer-motion';
import HomePage from '../../components/HomePage';
import FileDrop from '../../components/FileDrop';
import useSetting from '../../hooks/useSetting';
import Layout from './pages/Layout';
import { PlayerP, WordManagement } from './pages';

loader.config({ monaco });
export const api = window.electron;
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
            <HashRouter>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/*" element={<Layout />}>
                        <Route path="player/:videoId" element={<PlayerP />} />
                        <Route
                            path="word-management"
                            element={<WordManagement />}
                        />
                    </Route>
                </Routes>
            </HashRouter>
        </FileDrop>
    );
}
