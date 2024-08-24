import React, { forwardRef } from 'react';
import SentenceC from '../../common/types/SentenceC';
import useSetting from '../hooks/useSetting';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '@/fronted/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { motion } from 'framer-motion';

interface SideSentenceNewParam {
    sentence: SentenceC;
    onClick: (sentence: SentenceC) => void;
    isCurrent: boolean;
    isRepeat: boolean;
}

const IconTip = ({ tip, children }: { tip: string; children: React.ReactNode }) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    {children}
                </TooltipTrigger>
                <TooltipContent align={'start'}>
                    {tip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

};

const PlayingIcon = () => {
    return (
        <IconTip tip={'Playing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 className="lucide lucide-circle-play">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
        </IconTip>
    );
};

const RepeatPlayingIcon = () => {
    return (
        <IconTip tip={'Repeat Playing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 className="lucide lucide-circle-percent">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="M9 9h.01" />
                <path d="M15 15h.01" />
            </svg>
        </IconTip>
    );
};

const NormalPausingIcon = () => {
    return (
        <IconTip tip={'Pausing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-circle-pause">
                <circle cx="12" cy="12" r="10" />
                <line x1="10" x2="10" y1="15" y2="9" />
                <line x1="14" x2="14" y1="15" y2="9" />
            </svg>
        </IconTip>
    );
};

const AutoPausingIcon = () => {
    return (
        <IconTip tip={'Auto Pausing'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round"
                 className="lucide lucide-octagon-pause">
                <path d="M10 15V9" />
                <path d="M14 15V9" />
                <path d="M7.714 2h8.572L22 7.714v8.572L16.286 22H7.714L2 16.286V7.714z" />
            </svg>
        </IconTip>
    );
};

const SideSentence = forwardRef<HTMLDivElement, SideSentenceNewParam>(
    ({ sentence, onClick, isCurrent, isRepeat }: SideSentenceNewParam, ref) => {
        const playing = usePlayerController((state) => state.playing);
        const s = [sentence.text, sentence.textZH, sentence.msTranslate].find(
            (i) => i !== undefined && i !== ''
        );
        const fontSize = useSetting((state) =>
            state.values.get('appearance.fontSize')
        );
        const ap = usePlayerController.getState().internal.onPlaySeekTime !== null;
        const [hover, setHover] = React.useState(false);
        const show = usePlayerController(state => {
            if (!state.syncSide) {
                return true;
            } else {
                return state.showEn
            }
        });
        const icon = () => {
            if (playing) {
                return isRepeat ? <RepeatPlayingIcon /> : <PlayingIcon />;
            } else {
                return ap ? <AutoPausingIcon /> : <NormalPausingIcon />;
            }

        };

        return (
            // eslint-disable-next-linejsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
            <div
                className={cn(
                    'm-1.5 mr-0.5 px-1 py-2 border-0 flex gap-1 content-start rounded-lg',
                    'hover:drop-shadow-lg drop-shadow',
                    'bg-stone-200 dark:bg-neutral-700',
                    'hover:bg-stone-100 dark:hover:bg-neutral-600',
                    !show && 'transition-colors duration-500',
                    fontSize === 'fontSizeSmall' ? 'text-base' : 'text-lg'
                )}
                onClick={() => {
                    onClick(sentence);
                }}
                onMouseEnter={() => {
                    setHover(true);
                }}
                onMouseLeave={() => {
                    setHover(false);
                }}
                ref={ref}
            >
                <div
                    className={cn(
                        'flex flex-col items-center justify-center',
                        isCurrent ? 'visible' : 'invisible',
                        fontSize === 'fontSizeSmall' ? 'w-5 h-5' : 'w-7 h-7',
                        fontSize === 'fontSizeSmall' ? 'text-base' : 'text-lg',
                        `text-red-500 dark:text-red-600`
                    )}
                >
                    {icon()}
                </div>

                <motion.div
                    className={cn(
                        'w-full text-center',
                        hover || show ? 'text-opacity-100' : 'text-opacity-0'
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hover || show ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {s ?? ''}
                </motion.div>
            </div>
        );
    }
);

export default SideSentence;
