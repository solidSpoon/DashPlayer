import ProgressBar from '@ramonak/react-progress-bar';
import { useShallow } from 'zustand/react/shallow';
import useFile from '../hooks/useFile';
import usePlayerController from '../hooks/usePlayerController';

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
        <>
            <div className="w-full h-2 bg-stone-200" />
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
            {hasSubTitle && (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1 1"
                    className="absolute bottom-0 right-0 w-1 h-1 fill-scrollbarTrack -translate-x-2 -rotate-90 -translate-y-2"
                >
                    <path d="M 0 0 L 0 1 L 1 1 C 0 1 0 0 0 0 Z" />
                </svg>
            )}
        </>
    );
};

export default BorderProgressBar;
