import React from 'react';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import { VscFolderOpened, VscHistory } from 'react-icons/vsc';
import { IoRefreshCircleOutline } from 'react-icons/io5';
import FileSelector from './fileBowser/FileSelector';
import useProjectBrowser from '../hooks/useProjectBrowser';
import FileItem from './fileBowser/FileItem';
import { cn } from '../../common/utils/Util';

const FileBrowser = () => {
    const navigate = useNavigate();
    const { list, refresh, loading, path, routeTo } = useProjectBrowser(
        'route',
        (videoId) => navigate(`/player/${videoId}`)
    );
    console.log('list', list);
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
            }}
            className={twMerge(
                'flex-1 flex flex-col gap-2 items-center justify-center p-5 xl:p-10 rounded-lg w-full h-full text-black',
                'bg-white/90 drop-shadow-lg'
            )}
        >
            <FileSelector className="text-base" directory={false} />
            <FileSelector directory />
            <div className={cn('w-full flex items-center gap-2')}>
                {path ? (
                    <VscFolderOpened className="flex-shrink-0 w-4 h-4" />
                ) : (
                    <VscHistory className="flex-shrink-0 w-4 h-4" />
                )}
                <div className={cn('flex-1 truncate text-lg')}>
                    {path ?? '最近播放'}
                </div>
                <div
                    onClick={() => {
                        if (!loading) {
                            refresh();
                        }
                    }}
                    className={cn(
                        'ml-auto w-8 h-8 rounded hover:bg-gray-200 p-1 grid place-content-center'
                    )}
                >
                    <IoRefreshCircleOutline
                        className={cn(
                            'w-5 h-5 flex-shrink-0 ',
                            loading && 'animate-spin'
                        )}
                    />
                </div>
            </div>
            <FileItem
                key="back"
                onClick={() => routeTo(null)}
                content={path ? '..' : '.'}
            />
            <div
                className={cn(
                    'w-full h-0 flex-1 overflow-y-auto scrollbar-none'
                )}
            >
                {list.map((item) => {
                    return (
                        <FileItem
                            className={cn(
                                'text-sm',
                                item.playing === 'playing'
                                    ? 'bg-orange-200 hover:bg-orange-200/50'
                                    : ''
                            )}
                            key={item.key}
                            icon={item.icon}
                            onClick={item.callback}
                            content={item.name}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default FileBrowser;
