import React from 'react';
import { VscFolderOpened, VscHistory } from 'react-icons/vsc';
import { cn } from '../../utils/Util';
import useProjectBrowser from '../hooks/useProjectBrowser';
import WatchProjectItem from './WatchProjectItem';
import WatchProjectItemDetail from './WatchProjectItemDetail';

const WatchProjectBrowser = () => {
    const {
        recentPlaylists,
        currentProject,
        routeTo
    } = useProjectBrowser();
    const showDetail = (currentProject?.videos.length ?? 0) > 1 ||
        recentPlaylists.length === 1 && recentPlaylists[0].videos.length > 1;
    return (
        <>
            <div
                className={cn(
                    'text-xl font-bold w-full flex gap-2'
                )}
            >
                {!showDetail ? (
                    <>
                        <VscHistory />
                        最近播放
                    </>
                ) : (
                    <>
                        <VscFolderOpened />
                        {currentProject?.project_name}
                    </>
                )}
            </div>
            <div className='w-full flex-1 h-0 flex flex-col overflow-y-auto scrollbar-none text-sm'>
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
                {showDetail && (<WatchProjectItemDetail
                    item={currentProject??recentPlaylists[0]}
                    onRouteTo={(id) => {
                        routeTo(id);
                    }}
                />)}
            </div>
        </>
    );
};

export default WatchProjectBrowser;
