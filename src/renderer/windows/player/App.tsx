import React, { useEffect } from 'react';
import './App.css';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import useFile from '../../hooks/useFile';
import PlayerPage from '../../components/PlayerPage';
import HomePage from '../../components/HomePage';
import FileDrop from '../../components/FileDrop';

export const api = window.electron;
export default function App() {
    const { videoFile, subtitleFile, updateFile } = useFile();
    const [maximized, setMaximized] = React.useState<boolean>(false);
    const [isDragging, setIsDragging] = React.useState<boolean>(false);
    useEffect(() => {
        if (videoFile === undefined && subtitleFile === undefined) {
            api.homeSize();
        } else {
            api.playerSize();
        }
    }, [videoFile, subtitleFile]);
    useEffect(() => {
        const unListen = api.onMaximize(() => {
            if (!maximized) setMaximized(true);
        });
        return () => {
            unListen();
        };
    }, [maximized]);
    const showPlayerPage =
        (videoFile !== undefined || subtitleFile !== undefined) && maximized;
    return (
        <FileDrop
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            onFileChange={updateFile}
        >
            {showPlayerPage ? (
                <PlayerPage
                    videoFile={videoFile}
                    subtitleFile={subtitleFile}
                    updateFile={updateFile}
                />
            ) : (
                <HomePage />
            )}
        </FileDrop>
    );
}
