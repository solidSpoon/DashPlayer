import React from 'react';
import { pathToFile } from '../../lib/FileParser';
import useFile from '../../hooks/useFile';
import { cn } from '../../../utils/Util';
import usePlayerController from '../../hooks/usePlayerController';
import { useNavigate } from "react-router-dom";
import FileItem from './FileItem';

export interface OpenFileProps {
    directory?: boolean;
    className?: string;
}

const api = window.electron;

export default function FileSelector({ directory, className }: OpenFileProps) {
    const updateFile = useFile((s) => s.updateFile);
    const changePopType = usePlayerController((s) => s.changePopType);
    const navigate = useNavigate();
    const handleClick = async () => {
        const project = await api.selectFile(directory ?? false);
        console.log('project', project);
        if (!project) {
            return;
        }
        if (typeof project === 'string') {
            // 是字幕文件
            const file = await pathToFile(project);
            updateFile(file);
            changePopType('none');
            return;
        }

        console.log('project', project);
        const video = project.videos.filter((v) => {
            return v.current_playing === true;
        })[0];
        if (!video) {
            return;
        }
        api.playerSize();
        navigate(`/player/${video.id}`);
        changePopType('none');
    };

    return (
        <>
            {directory && (
                <FileItem
                    content="打开文件夹..."
                    className={cn('w-full', className)}
                    onClick={() => handleClick()}
                />
            )}
            {!directory && (
                <FileItem
                    content="打开文件..."
                    className={cn('w-full', className)}
                    onClick={() => handleClick()}
                />
            )}
        </>
    );
}

FileSelector.defaultProps = {
    directory: false,
    className: '',
};
