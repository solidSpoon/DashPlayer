import { cn } from '@/common/utils/Util';
import React, { useEffect } from 'react';

export interface ButtonParam {
    onClick?: () => void;
    title?: string;
    className?: string;
    children?: React.ReactNode;
}
const Button = ({ children, onClick, title, className }: ButtonParam) => {
    const [clicked, setClicked] = React.useState(false);
    useEffect(() => {
        if (clicked) {
            setTimeout(() => {
                setClicked(false);
            }, 1000);
        }
    }, [clicked]);
    return (
        <div
            onClick={() => {
                setClicked(true);
                onClick?.();
            }}
            className={cn(
                'flex gap-2 rounded-lg hover:bg-gray-100 px-2 py-1 w-full text-base justify-start items-center h-10',
                className
            )}
        >
            {children && React.cloneElement(children as React.ReactElement, {
                className: cn('text-gray-500 w-8 h-8 transition-all duration-500',
                    clicked && 'text-green-500 scale-105'),
            })}
            <div className={cn('flex flex-col justify-center'
            )}>
                <span>{title}</span>
            </div>
        </div>
    );
};
Button.defaultProps = {
    checked: false,
    onChange: (checked: boolean) => {
        //
    },
    title: 'Toggle me',
    className: '',
};

export default Button;
