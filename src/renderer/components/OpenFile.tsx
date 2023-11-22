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
    const fileInputEl = useRef<HTMLInputElement>(null);
    const updateFile = useFile((s) => s.updateFile);
    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('handleFile', event.target.files);
        const files = event.target.files ?? [];
        for (let i = 0; i < files.length; i += 1) {
            const file = parseFile(files[i]);
            updateFile(file);
        }
    };

    const handleClick = async () => {
        await api.selectFile(isDirectory);
    }

    return (
        <>
            {isDirectory && (
                <input
                    type='file'
                    multiple
                    ref={fileInputEl} // 挂载ref
                    accept={ACCEPTED_FILE_TYPES} // 限制文件类型
                    hidden // 隐藏input
                    onChange={(event) => handleFile(event)}
                    // @ts-ignore
                    directory='true'
                    webkitdirectory='true'
                />
            )}
            {!isDirectory && (
                <input
                    type='file'
                    multiple
                    ref={fileInputEl} // 挂载ref
                    accept={ACCEPTED_FILE_TYPES} // 限制文件类型
                    hidden // 隐藏input
                    onChange={(event) => handleFile(event)}
                />
            )}
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                {isDirectory && <ListItem content={'打开文件夹'} onClick={() => handleClick()} />}
                {!isDirectory && <ListItem content={'打开文件'} onClick={() => handleClick()} />}
        </>
    );
}

OpenFile.defaultProps = {
    isDirectory: false,
    className: '',
};
