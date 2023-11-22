import { cn } from '../../utils/Util';
import { GoFile } from 'react-icons/go';
import React, { cloneElement, ReactElement } from 'react';
import { WatchProjectVO } from '../../db/service/WatchProjectService';
import { WatchProjectType } from '../../db/entity/WatchProject';
import { VscFolder } from 'react-icons/vsc';

export interface ListItemProps {
    content: string;
    onClick?: () => void;
    icon?: ReactElement | null;
}

const ListItem = ({content, onClick, icon}: ListItemProps) => {

    return (
        <div
            onClick={() => onClick?.()}
            className={cn(
                'w-full h-10 flex-shrink-0 flex justify-center items-center hover:bg-black/5 rounded-lg gap-3 px-6'
            )}
        >
            {icon && cloneElement(icon, {
                className: `w-4 h-4 fill-yellow-700/90`
            })}
            <div className='w-full truncate'>
                {content}
            </div>
        </div>
    );
};

ListItem.defaultProps = {
    onClick: () => {},
    icon: null,
}

export default ListItem;
