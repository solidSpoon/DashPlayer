import { cn } from '@/fronted/lib/utils';
import SubtitleStack from './SubtitleStack';
import OverlayControlBar from './OverlayControlBar';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';

const FullscreenSubtitleOverlay = () => {
    return (
        <div className={cn('w-full h-full absolute top-0 left-0 z-20 flex flex-col justify-end items-center pointer-events-none')}>
            <SubtitleStack />
            {/* 全屏控制条：播放/上一句/下一句/训练模式/字幕轨道与普通视图同一套控件 */}
            <OverlayControlBar
                onTimeChange={(time) => playerActions.seekTo({ time })}
            />
        </div>
    );
};

export default FullscreenSubtitleOverlay;
