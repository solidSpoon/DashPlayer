import { GoFile } from 'react-icons/go';
import React from 'react';
import { VscFolder } from 'react-icons/vsc';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/Util';
import { WatchProjectVO } from '../../db2/services/WatchProjectService';
import ListItem from './ListItem';
import useFile from '../hooks/useFile';

export interface WatchProjectItemProps {
    item: WatchProjectVO;
    onRouteTo?: () => void | undefined;
}

const WatchProjectItem = ({ item, onRouteTo }: WatchProjectItemProps) => {
    const file = item.videos.filter((v) => v.current_playing === 1)[0];
    console.log('watch project item', item);
    const currentVideo = useFile((e) => e.currentVideo);
    const navigate = useNavigate();
    const icon = item.videos.length === 1 ? <GoFile /> : <VscFolder />;
    const handleClick = () => {
        console.log('click', item);
        if (item.videos.length === 1 || onRouteTo === undefined) {
            navigate(`/player/${item.videos[0].id}`);
        } else {
            onRouteTo?.();
        }
    };
    return (
        <ListItem
            onClick={handleClick}
            icon={icon}
            className={cn(
                currentVideo?.project_id === item.id &&
                    'bg-orange-200 hover:bg-orange-200/50'
            )}
            content={`${item.project_name} ${file?.video_name}`}
        />
    );
};

WatchProjectItem.defaultProps = {
    onRouteTo: undefined,
};

export default WatchProjectItem;
