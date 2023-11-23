import { GoFile } from 'react-icons/go';
import React from 'react';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import ListItem from './ListItem';
import useFile from '../hooks/useFile';
import { useShallow } from 'zustand/react/shallow';

export interface WatchProjectItemDetailProps {
    item: WatchProjectVO;
    onRouteTo?: (id: number | null) => void;
}

const WatchProjectItemDetail = ({ item, onRouteTo }: WatchProjectItemDetailProps) => {
    console.log('watch project item', item);
    const { currentVideo, playFile } = useFile(useShallow((s) => ({
        currentVideo: s.currentVideo,
        playFile: s.playFile
    })));

    return (
        <div className="w-full flex flex-col gap-2 overflow-y-scroll">
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
                    }}
                    content={video.video_name ?? ''}
                    key={video.id}
                    icon={<GoFile />}
                />
            ))}
        </div>
    );
};

WatchProjectItemDetail.defaultProps = {
    onRouteTo: () => {}
};

export default WatchProjectItemDetail;
