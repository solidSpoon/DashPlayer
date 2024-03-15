import {cn} from "@/fronted/lib/utils";
import PlayerSubtitle from "@/fronted/components/playerSubtitle/PlayerSubtitle";
import PlayerSubtitleControlPannel from "@/fronted/components/playerSubtitle/PlayerSubtitleControlPannel";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import {useShallow} from "zustand/react/shallow";


const PlayerSubtitlePannel = () => {
    const {
        playing,
        play,
        pause,
        seekTo

    } = usePlayerController(
        useShallow((state) => ({
            playing: state.playing,
            muted: state.muted,
            volume: state.volume,
            play: state.play,
            pause: state.pause,
            seekTime: state.seekTime,
            updateExactPlayTime: state.updateExactPlayTime,
            setDuration: state.setDuration,
            seekTo: state.seekTo,
            playbackRate: state.playbackRate,
        }))
    );
    return (
        <div className={cn('w-full h-full absolute top-0 left-0 z-10 flex flex-col justify-end items-center')}>
            <PlayerSubtitle/>
            <PlayerSubtitleControlPannel
                onTimeChange={(time) => {
                    seekTo({time});
                }}
                onPause={() => {
                    pause();
                }}
                onPlay={() => {
                    play();
                }}
                playing={playing}
            />
        </div>
    )
}

export default PlayerSubtitlePannel;
