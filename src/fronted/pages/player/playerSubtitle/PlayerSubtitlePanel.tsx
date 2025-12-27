import { cn } from '@/fronted/lib/utils';
import PlayerSubtitle from '@/fronted/pages/player/playerSubtitle/PlayerSubtitle';
import PlayerSubtitleControlPanel from '@/fronted/pages/player/playerSubtitle/PlayerSubtitleControlPannel';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import { playerV2Actions } from '@/fronted/components/feature/player/player-v2';

const PlayerSubtitlePanel = () => {
    const playing = usePlayerV2State((state) => state.playing);

    return (
        <div className={cn('w-full h-full absolute top-0 left-0 z-10 flex flex-col justify-end items-center')}>
            <PlayerSubtitle />
            <PlayerSubtitleControlPanel
                onTimeChange={(time) => playerV2Actions.seekTo({ time })}
                onPause={() => playerV2Actions.pause()}
                onPlay={() => playerV2Actions.play()}
                playing={playing}
            />
        </div>
    );
};

export default PlayerSubtitlePanel;
