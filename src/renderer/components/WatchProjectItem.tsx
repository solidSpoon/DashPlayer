import { GoFile } from 'react-icons/go';
import React, { cloneElement, ReactElement } from 'react';
import { VscFolder } from 'react-icons/vsc';
import { cn } from '../../utils/Util';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import { WatchProjectType } from '../../db/entity/WatchProject';
import ListItem from './ListItem';
import useFile from '../hooks/useFile';
import { useShallow } from 'zustand/react/shallow';

export interface WatchProjectItemProps {
    item: WatchProjectVO;
    onRouteTo?: () => void;
}

const WatchProjectItem = ({ item, onRouteTo }: WatchProjectItemProps) => {
    const file = item.videos.filter((v) => v.id === item.current_video_id)[0];
    console.log('watch project item', item);
    const { currentVideo, playFile } = useFile(useShallow((s) => ({
        currentVideo: s.currentVideo,
        playFile: s.playFile
    })));
    const icon = item.videos.length === 1 ? <GoFile /> : <VscFolder />;
    const handleClick = () => {
        console.log('click', item);
        if (item.videos.length === 1) {
            playFile(item.videos[0]);
        } else {
            onRouteTo?.();
        }
    }
    return (
        <ListItem
            onClick={handleClick}
            icon={icon}
            className={cn(
                currentVideo?.project_id === item.id ? 'bg-orange-500/20' : ''
            )}
            content={`${item.project_name} ${file?.video_name}`}
        />
    );
};

WatchProjectItem.defaultProps = {
    onRouteTo: () => {}
};

export default WatchProjectItem;
