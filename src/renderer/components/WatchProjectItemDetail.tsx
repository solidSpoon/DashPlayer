import { GoFile } from 'react-icons/go';
import React from 'react';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import ListItem from './ListItem';
import useFile from '../hooks/useFile';
import { useShallow } from 'zustand/react/shallow';
import usePlayerController from '../hooks/usePlayerController';

export interface WatchProjectItemDetailProps {
    item: WatchProjectVO;
    onRouteTo?: (id: number | null) => void;
}

const WatchProjectItemDetail = ({ item, onRouteTo }: WatchProjectItemDetailProps) => {
    console.log('watch project item', item);
    const { playFile } = useFile(useShallow((s) => ({
        playFile: s.playFile
    })));
    const changePopType = usePlayerController(s=>s.changePopType);
    return (
        <div className="w-full flex flex-col gap-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-thumb-rounded">
            <ListItem
                onClick={() => {
                    onRouteTo?.(null);
                }}
                content="..."
            />

            {item.videos.map((video) => (
                <ListItem
                    onClick={() => {
                        playFile(video);
                        changePopType('none');
                    }}
                    content={video.video_name ?? ''}
                    key={video.id}
                    icon={<GoFile />}
                />
            ))}
        </div>
    );
};

export default WatchProjectItemDetail;
