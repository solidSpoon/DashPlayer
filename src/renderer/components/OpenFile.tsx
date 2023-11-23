import React, { useRef } from 'react';
import parseFile from '../lib/FileParser';
import useFile from '../hooks/useFile';
import { ACCEPTED_FILE_TYPES } from '../../utils/MediaTypeUitl';
import { cn } from '../../utils/Util';
import ListItem from './ListItem';
import usePlayerController from '../hooks/usePlayerController';

export interface OpenFileProps {
    isDirectory?: boolean;
    className?: string;
}

const api = window.electron;

export default function OpenFile({ isDirectory, className }: OpenFileProps) {
    const playFile = useFile(s=>s.playFile);
    const changePopType = usePlayerController(s=>s.changePopType);
    const handleClick = async () => {
        let project = await api.selectFile(isDirectory ?? false);
        console.log('project', project);
        if (!project) {
            return;
        }
       const video = project.videos.filter((v) => {
           return  v.current_playing === 1;
        })[0];
        if (!video) {
            return;
        }
        playFile(video);
        changePopType('none');
    };

    return (
        <>
            {isDirectory && (
                <ListItem content="打开文件夹..."
                          className={cn('',className)}
                          onClick={() => handleClick()} />
            )}
            {!isDirectory && (
                <ListItem content="打开文件..."
                            className={cn('',className)}
                          onClick={() => handleClick()} />
            )}
        </>
    );
}

OpenFile.defaultProps = {
    isDirectory: false,
    className: '',
};
