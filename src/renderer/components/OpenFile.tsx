import React, { useRef } from 'react';
import parseFile from '../lib/FileParser';
import useFile from '../hooks/useFile';
import { ACCEPTED_FILE_TYPES } from '../../utils/MediaTypeUitl';
import { cn } from '../../utils/Util';
import ListItem from './ListItem';

export interface OpenFileProps {
    isDirectory?: boolean;
    className?: string;
}

const api = window.electron;

export default function OpenFile({ isDirectory, className }: OpenFileProps) {
    const handleClick = async () => {
        await api.selectFile(isDirectory ?? false);
    };

    return (
        <>
            {isDirectory && (
                <ListItem content="打开文件夹" onClick={() => handleClick()} />
            )}
            {!isDirectory && (
                <ListItem content="打开文件" onClick={() => handleClick()} />
            )}
        </>
    );
}

OpenFile.defaultProps = {
    isDirectory: false,
    className: '',
};
