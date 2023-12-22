import { cn } from '../../../common/utils/Util';
import { cloneElement, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ToolTip';

export interface IconButtonProps {
    onClick: () => void;
    icon: React.ReactElement;
    tooltip: string;
    className?: string;
}

const IconButton = ({ onClick, icon, tooltip, className: ic }: IconButtonProps) => {
    const [open, setOpen] = useState(false);
    const timeout = useRef<NodeJS.Timeout>();

    const iconElement = cloneElement(icon, {
        className: cn('cursor-pointer', ic),
        onClick: onClick
    });

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
    }
    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClicked}
            >
                {iconElement}
            </TooltipTrigger>
            <TooltipContent
                className='bg-stone-50 rounded border border-gray-300 py-1 px-2 text-sm text-stone-500 drop-shadow-lg'
            >
                {tooltip}
            </TooltipContent>
        </Tooltip>
    );
};

IconButton.defaultProps = {
    className: ''
};

export default IconButton;
