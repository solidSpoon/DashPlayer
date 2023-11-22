import { GoFile } from 'react-icons/go';
import React, { cloneElement, ReactElement } from 'react';
import { VscFolder } from 'react-icons/vsc';
import { cn } from '../../utils/Util';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import { WatchProjectType } from '../../db/entity/WatchProject';
import ListItem from './ListItem';

export interface WatchProjectItemProps {
    item: WatchProjectVO;
    onClick?: () => void;
    icon?: ReactElement | null;
}

const WatchProjectItem = ({ item, onClick, icon }: WatchProjectItemProps) => {
    const file = item.videos.filter((v) => v.id === item.current_video_id)[0];
    console.log('watch project item', item);

    // copy icon

    return (
        <ListItem
            onClick={() => onClick?.()}
            icon={icon}
            content={`${item.project_name} ${file?.video_name}`}
        />
    );
};

WatchProjectItem.defaultProps = {
    onClick: () => {},
    icon: null,
};

export default WatchProjectItem;
