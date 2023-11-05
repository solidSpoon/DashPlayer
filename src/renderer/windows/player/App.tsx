import React, { useEffect, useState } from 'react';
import './App.css';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import { Editor, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import useFile from '../../hooks/useFile';
import PlayerPage from '../../components/PlayerPage';
import HomePage from '../../components/HomePage';
import FileDrop from '../../components/FileDrop';
import useSystem from '../../hooks/useSystem';

loader.config({ monaco });
export const api = window.electron;
export default function App() {
    const loadedNum = useFile((s) => s.openedNum);
    const [maximized, setMaximized] = React.useState<boolean>(false);
    const [isDragging, setIsDragging] = React.useState<boolean>(false);
    const windowState = useSystem((s) => s.windowState);
    useEffect(() => {
        if (loadedNum === 0) {
            api.homeSize();
        } else if (!maximized) {
            api.playerSize();
        }
    }, [loadedNum, maximized]);
    useEffect(() => {
        if (windowState === 'maximized' && !maximized) {
            setMaximized(true);
        }
    }, [maximized, windowState]);
    const showPlayerPage = loadedNum > 0 && maximized;
    return (
        <FileDrop isDragging={isDragging} setIsDragging={setIsDragging}>
            {showPlayerPage ? (
                <PlayerPage isDragging={isDragging} />
            ) : (
                <HomePage />
            )}
        </FileDrop>
    );
}
