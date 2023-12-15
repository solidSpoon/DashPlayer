import { GoFile } from 'react-icons/go';
import React, { useRef, useState } from 'react';
import { VscFolder } from 'react-icons/vsc';
import { cn } from '../../../utils/Util';
import { Tooltip, TooltipContent, TooltipTrigger } from '../toolTip/ToolTip';
import { FileBrowserIcon } from './FileBrowserIcon';

export interface FileItemProps {
    icon?: keyof typeof FileBrowserIcon;
    content: string;
    onClick: () => void;
    className?: string;
}

const FileItem = ({ icon, content, onClick, className }: FileItemProps) => {
    const [open, setOpen] = useState(false);
    const timeout = useRef<NodeJS.Timeout>();

    const handleMouseEnter = () => {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
        timeout.current = setTimeout(() => {
            setOpen(true);
        }, 500);
    };

    const handleMouseLeave = () => {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
        setOpen(false);
    };
    const handleClicked = () => {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
        setOpen(false);
    };
    return (
        <Tooltip
            open={open} onOpenChange={setOpen}>
            <TooltipTrigger
                className={cn(
                    'w-full flex-shrink-0 flex justify-start items-center hover:bg-black/5 rounded-lg gap-3 px-3 lg:px-6 py-2',
                    className
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                    handleClicked();
                    onClick?.();
                }}
            >
                <>
                    {FileBrowserIcon[icon ?? 'none'] ?? <></>}
                    <div className='truncate'>{content}</div>
                </>
            </TooltipTrigger>
            <TooltipContent
                className='bg-stone-50 rounded border border-gray-300 py-1 px-2 text-sm text-stone-500 drop-shadow-lg'
            >
                {content}
            </TooltipContent>
        </Tooltip>
    );
};

FileItem.defaultProps = {
    className: '',
    icon: 'none'
};

export default FileItem;
