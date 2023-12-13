
import { GoFile } from 'react-icons/go';
import React, { cloneElement } from 'react';
import { VscFolder } from 'react-icons/vsc';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../utils/Util';
import ListItem from './atom/ListItem';
import useFile from '../../hooks/useFile';
import { WatchProjectVO } from '../../../db/services/WatchProjectService';

export interface FileItemProps {
    icon?: 'file' | 'folder'| 'none';
    content: string;
    onClick: () => void;
    className?: string;
}

const FileItem = ({ icon, content, onClick, className }: FileItemProps) => {
    return (
        <div
            onClick={() => onClick?.()}
            className={cn(
                'w-full flex-shrink-0 flex justify-center items-center hover:bg-black/5 rounded-lg gap-3 px-3 lg:px-6 py-2',
                className
            )}
        >
            {icon === 'file' && (
                <GoFile className={cn('w-4 h-4 fill-yellow-700/90')} />
            )}
            {icon === 'folder' &&(
                <VscFolder className={cn('w-4 h-4 fill-yellow-700/90')} />
            )}
            <div className="w-full truncate">{content}</div>
        </div>
    );
};

FileItem.defaultProps = {
    className: '',
    icon: 'none',
};

export default FileItem;
