import React, { useEffect } from 'react';
import './App.css';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import useFile from '../../hooks/useFile';
import PlayerPage from '../../components/PlayerPage';
import HomePage from '../../components/HomePage';
import FileDrop from '../../components/FileDrop';
import useSystem from '../../hooks/useSystem';

export const api = window.electron;
export default function App() {
    const loadedNum = useFile((s) => s.loadedNum);
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
