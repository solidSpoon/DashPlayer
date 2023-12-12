import React from 'react';
import { twMerge } from 'tailwind-merge';
import FileSelector from './fileBowser/atom/FileSelector';
import { useNavigate } from 'react-router-dom';
import useProjectBrowser from '../hooks/useProjectBrowser';
import FileItem from './fileBowser/FileItem';
import { cn } from '../../utils/Util';
import { VscFolderOpened, VscHistory } from 'react-icons/vsc';
import { IoRefreshCircleOutline } from 'react-icons/io5';

const FileBrowser = () => {
    const navigate = useNavigate();
    const { list, refresh, loading, path, routeTo } =
        useProjectBrowser('route', (videoId) => navigate(`/player/${videoId}`));
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={twMerge(
                'flex-1 flex flex-col gap-2 items-center justify-center p-10 rounded-lg w-full h-full text-black',
                'bg-white drop-shadow-lg'
            )}
        >
            <FileSelector directory={false} />
            <FileSelector directory />
            <div className={cn('w-full flex items-center gap-2')}>
                {path ? <VscFolderOpened className={'flex-shrink-0'} /> : <VscHistory className={'flex-shrink-0'} />}
                <div className={cn('flex-1 truncate')}>
                    {path ?? '最近播放'}
                </div>
                <div
                    onClick={() => {
                        if (!loading) {
                            refresh();
                        }
                    }}
                    className={cn(
                        'ml-auto w-8 h-8 rounded hover:bg-gray-200 p-1'
                    )}
                >
                    <IoRefreshCircleOutline
                        className={cn(
                            'w-full h-full flex-shrink-0',
                            loading && 'animate-spin'
                        )}
                    />
                </div>
            </div>
            <FileItem key={'back'} onClick={() => routeTo(null)} content={path ? '..' : '.'} />
            <div className={cn('w-full h-0 flex-1 overflow-y-auto scrollbar-none')}>
                {list.map((item) => {
                    return (
                        <FileItem
                            className={cn(item.playing?'bg-orange-200 hover:bg-orange-200/50':'')}
                            key={item.key} icon={item.icon} onClick={item.callback} content={item.name} />
                    );
                })}
            </div>

        </div>
    );
};

export default FileBrowser;
