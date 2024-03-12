import React, { useRef, useState } from 'react';
import { cn, strBlank } from '@/common/utils/Util';
import FileBrowserIcon from './FileBrowserIcon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

export interface FileItemProps {
    icon?: keyof typeof FileBrowserIcon;
    content: string;
    tip?: string;
    onClick: () => void;
    className?: string;
}

const FileItem = ({
                      icon,
                      content,
                      tip,
                      onClick,
                      className
                  }: FileItemProps) => {
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
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
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
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side={'bottom'}
                    align={'start'}
                >
                    {strBlank(tip) ? content : tip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

FileItem.defaultProps = {
    className: '',
    icon: 'none',
    tip: ''
};

export default FileItem;
