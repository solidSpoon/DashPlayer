import { GoFile } from 'react-icons/go';
import React from 'react';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import ListItem from './ListItem';
import useFile from '../hooks/useFile';
import { useShallow } from 'zustand/react/shallow';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '../../utils/Util';

export interface WatchProjectItemDetailProps {
    item: WatchProjectVO;
    onRouteTo?: (id: number | null) => void;
    className?: string;
}

const WatchProjectItemDetail = ({ item, onRouteTo, className }: WatchProjectItemDetailProps) => {
    console.log('watch project item', item);
    const { playFile, currentVideo } = useFile(useShallow((s) => ({
        playFile: s.playFile,
        currentVideo: s.currentVideo
    })));
    const changePopType = usePlayerController(s => s.changePopType);
    return (
        <div
            className={cn('w-full flex flex-col gap-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-thumb-rounded', className)}>
            <ListItem
                onClick={() => {
                    onRouteTo?.(null);
                }}
                content='...'
            />

            {item.videos.map((video) => {
                const isCurrent = currentVideo?.id === video.id;
                return <ListItem
                    className={cn(isCurrent && 'bg-orange-200 hover:bg-orange-200/50')}
                    onClick={() => {
                        playFile(video);
                        changePopType('none');
                    }}
                    content={video.video_name ?? ''}
                    key={video.id}
                    icon={<GoFile />}
                />;
            })}
        </div>
    );
};

WatchProjectItemDetail.defaultProps = {
    className: '',
    onRouteTo: () => {
    }
};

export default WatchProjectItemDetail;
