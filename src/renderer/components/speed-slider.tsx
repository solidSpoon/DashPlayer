import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../common/utils/Util';
import { autoPlacement, offset, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';

export interface VolumeSliderProps {
    speed: number;
    onSpeedChange: (speed: number) => void;
}

const SpeedSlider = ({ speed, onSpeedChange }: VolumeSliderProps) => {
    const [open, setOpen] = useState(false);
    const { refs, floatingStyles, context } = useFloating({
        open: open,
        onOpenChange: setOpen,
        middleware: [
            offset(5),
            autoPlacement({
                allowedPlacements: [
                    'top'
                ]
            })
        ]
    });
    const click = useClick(context);
    const dismiss = useDismiss(context);
    const inputRef = useRef<HTMLInputElement>(null);
    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss
    ]);
    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
        }
    }, [open]);
    const pageSelectItem = (num: number) => {
        return (
            <div
                onClick={() => {
                    onSpeedChange(num);
                    setOpen(false);
                }}
                className={cn(
                    'flex flex-row w-full items-center justify-start px-2 py-1 rounded hover:bg-neutral-700 text-sm',
                    'cursor-pointer',
                    speed === num ? 'bg-neutral-700' : ''
                )}
            >
                {num}
            </div>
        );
    };
    return (
        <>
            <div
                ref={refs.setReference}
                className=''
                {...getReferenceProps()}
            >
                <div
                    onClick={() => {
                        setOpen(!open);
                    }}
                    className={cn('h-8 bg-white/90 rounded text-neutral-500 font-bold grid place-content-center px-2')}>
                    <span>{speed.toFixed(2)}x</span>
                </div>
            </div>
            {open && (
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    className={cn(
                        'z-50 pointer-events-none'
                    )}
                >
                    <div
                        className={cn(
                            'w-36 bg-neutral-800 border-neutral-600 border-[0.5px] rounded flex flex-col p-2 translate-x-10 pointer-events-auto'
                        )}
                    >
                        {pageSelectItem(0.25)}
                        {pageSelectItem(0.5)}
                        {pageSelectItem(0.75)}
                        {pageSelectItem(1)}
                        {pageSelectItem(1.25)}
                        {pageSelectItem(1.5)}
                        {pageSelectItem(1.75)}
                        {pageSelectItem(2)}
                        <input
                            ref={inputRef}
                            defaultValue={speed}
                            type={'number'}
                            min={0.25} // 最小速度
                            max={6} // 最大速度
                            step={0.25} // 步进值
                            className={cn('w-full bg-neutral-700 rounded border-neutral-600 border-[0.5px] text-white p-1 focus:outline-none mt-1')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setOpen(false);
                                    onSpeedChange(parseFloat(parseFloat(e.currentTarget.value).toFixed(2)));
                                }
                            }}
                            onChange={(e) => {
                                console.log('onChange', e.currentTarget.value);
                                onSpeedChange(parseFloat(parseFloat(e.currentTarget.value).toFixed(2)));
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default SpeedSlider;
