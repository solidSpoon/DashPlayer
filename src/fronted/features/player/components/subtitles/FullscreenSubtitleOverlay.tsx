import { cn } from '@/fronted/lib/utils';
import SubtitleStack from './SubtitleStack';
import OverlayControlBar from './OverlayControlBar';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';

const FullscreenSubtitleOverlay = () => {
    const playing = usePlayerState((state) => state.playing);

    return (
        <div className={cn('w-full h-full absolute top-0 left-0 z-10 flex flex-col justify-end items-center')}>
            <SubtitleStack />
            <OverlayControlBar
                onTimeChange={(time) => playerActions.seekTo({ time })}
                onPause={() => playerActions.pause()}
                onPlay={() => playerActions.play()}
                playing={playing}
            />
        </div>
    );
};

export default FullscreenSubtitleOverlay;
