import ProgressBar from '@ramonak/react-progress-bar';
import { useShallow } from 'zustand/react/shallow';
import useFile from '../hooks/useFile';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from "../../utils/Util";

const BorderProgressBar = () => {
    const hasSubTitle = useFile((s) => s.subtitleFile !== undefined);
    const { duration, playTime } = usePlayerController(
        useShallow((s) => ({
            duration: s.duration,
            playTime: s.playTime,
        }))
    );
    const completed = (playTime / duration) * 100;
    return (
        <div className={cn('relative w-full h-2 bg-stone-200')}>
            <div className="absolute bottom-0 w-full z-50 bg-scrollbarTrack">
                <ProgressBar
                    baseBgColor="rgb(var(--colors-scrollbarTrack))"
                    bgColor="rgb(var(--colors-progressbarComplete))"
                    completed={completed}
                    transitionDuration="0.2s"
                    isLabelVisible={false}
                    height="8px"
                    width="100%"
                    borderRadius={`${hasSubTitle ? '0 8px 8px 0' : '0'}`}
                />
            </div>
        </div>
    );
};

export default BorderProgressBar;
