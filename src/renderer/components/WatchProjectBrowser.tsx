import React from 'react';
import { VscFolderOpened, VscHistory } from 'react-icons/vsc';
import { IoRefreshCircleOutline } from 'react-icons/io5';
import { cn } from '../../utils/Util';
import useProjectBrowser from '../hooks/useProjectBrowser';
import WatchProjectItem from './WatchProjectItem';
import WatchProjectItemDetail from './WatchProjectItemDetail';

const api = window.electron;

const WatchProjectBrowser = () => {
    const { recentPlaylists, currentProject, routeTo, refresh, loading } =
        useProjectBrowser();
    const showDetail =
        (currentProject?.videos.length ?? 0) > 1 ||
        (recentPlaylists.length === 1 && recentPlaylists[0].videos.length > 1);

    return (
        <>
            <div
                className={cn(
                    'text-xl font-bold w-full flex items-center gap-2'
                )}
            >
                {!showDetail ? (
                    <>
                        <VscHistory />
                        最近播放
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
                                    'w-full h-full',
                                    loading && 'animate-spin'
                                )}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <VscFolderOpened />
                        {currentProject?.project_name}
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
                                    'w-full h-full',
                                    loading && 'animate-spin'
                                )}
                            />
                        </div>
                    </>
                )}
            </div>
            <div className="w-full flex-1 h-0 flex flex-col text-sm scrollbar-none">
                {!showDetail &&
                    recentPlaylists.map((pl) => {
                        return (
                            <WatchProjectItem
                                item={pl}
                                onRouteTo={() => {
                                    routeTo(pl.id);
                                }}
                            />
                        );
                    })}
                {showDetail && (
                    <WatchProjectItemDetail
                        item={currentProject ?? recentPlaylists[0]}
                        onRouteTo={(id) => {
                            routeTo(id);
                        }}
                    />
                )}
            </div>
        </>
    );
};

export default WatchProjectBrowser;
